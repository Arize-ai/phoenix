import asyncio
import contextlib
import os
import threading
from asyncio import AbstractEventLoop
from functools import partial
from importlib.metadata import version
from random import getrandbits
from secrets import token_hex
from typing import (
    Any,
    AsyncIterator,
    Awaitable,
    Callable,
    Iterable,
    Iterator,
    Literal,
    Optional,
    Union,
)

import aiosqlite
import httpx
import pytest
import sqlalchemy
import sqlean
import strawberry
from _pytest.config import Config
from _pytest.fixtures import SubRequest
from _pytest.tmpdir import TempPathFactory
from asgi_lifespan import LifespanManager
from faker import Faker
from fastapi import APIRouter, FastAPI
from fastapi._compat import v2 as fastapi_v2
from pydantic import SecretStr, TypeAdapter
from pydantic_ai import RunContext
from pytest import FixtureRequest
from pytest_postgresql.janitor import DatabaseJanitor
from sqlalchemy import URL, StaticPool
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, AsyncSession, create_async_engine
from starlette.types import ASGIApp
from strawberry.extensions import SchemaExtension

from phoenix.db import models
from phoenix.db.bulk_inserter import BulkInserter
from phoenix.db.engines import (
    _dumps as _json_serializer,
)
from phoenix.db.engines import (
    aio_postgresql_engine,
    aio_sqlite_engine,
    set_sqlite_pragma,
)
from phoenix.db.facilitator import Facilitator
from phoenix.db.insertion.helpers import DataManipulation
from phoenix.server import app as server_app
from phoenix.server.agents.capabilities import MintlifyDocsMCPServer
from phoenix.server.api.schema import build_graphql_schema
from phoenix.server.app import _db, create_app
from phoenix.server.encryption import EncryptionService
from phoenix.server.grpc_server import GrpcServer
from phoenix.server.redaction import Redactor
from phoenix.server.types import BatchedCaller, DbSessionFactory
from phoenix.trace.schemas import Span
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.vcr import CustomVCR


def pytest_configure(config: Config) -> None:
    config.addinivalue_line(
        "markers",
        "postgres_only: mark a test as requiring PostgreSQL (skipped under --db sqlite)",
    )
    config.addinivalue_line(
        "markers",
        "real_monty_runtime_probe: run the real Monty runtime startup probe "
        "(spawns a worker subprocess)",
    )
    config.addinivalue_line(
        "markers",
        "real_agent_mcp_server: derive the agent's MCP server from the OpenAPI document",
    )
    config.addinivalue_line(
        "markers",
        "real_docs_mcp_server: build the real docs MCP toolset, which opens an HTTPS MCP "
        "session to the Mintlify host during lifespan startup",
    )
    config.addinivalue_line(
        "markers",
        "real_agent_session_sweeper: run the app's agent-session sweeper loop",
    )
    config.addinivalue_line(
        "markers",
        "seeded_model_costs: sync the model cost manifest into the database during app startup",
    )
    config.addinivalue_line(
        "markers",
        "real_key_derivation: derive the encryption and redaction keys with the real PBKDF2 "
        "rounds instead of the memoized ones",
    )
    config.addinivalue_line(
        "markers",
        "pristine_db: give the test an empty database instead of one carrying the rows the "
        "app seeds at startup",
    )
    config.addinivalue_line(
        "markers",
        "real_graphql_schema_build: build a fresh GraphQL schema for the app instead of "
        "reusing the worker's memoized one",
    )
    config.addinivalue_line(
        "markers",
        "real_app_routers: build the app's routers fresh instead of reusing the worker's "
        "memoized ones",
    )
    config.addinivalue_line(
        "markers",
        "real_fastapi_type_adapters: build fresh pydantic TypeAdapters for the app's routes "
        "instead of reusing the worker's memoized ones",
    )


@pytest.fixture(autouse=True)
def _stub_code_mode_startup_check(request: FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    """The code-mode startup check spawns a worker subprocess, and MCP plus code
    mode default on — so every app-lifespan test would pay that spawn inside
    asgi_lifespan's 5s startup budget. Stubbed suite-wide; tests exercising the
    check itself opt back in with ``@pytest.mark.real_monty_runtime_probe``."""
    if request.node.get_closest_marker("real_monty_runtime_probe"):
        return

    async def _skip(self: Any) -> bool:
        return True

    monkeypatch.setattr("phoenix.server.monty_runtime.MontyRuntime.probe_runtime", _skip)


@pytest.fixture(autouse=True)
def _stub_agent_mcp_server(request: FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    """Deriving the agent's MCP server generates the OpenAPI document, about
    half a second per app. Stubbed suite-wide; tests that need the real server
    opt in with ``@pytest.mark.real_agent_mcp_server``."""
    if request.node.get_closest_marker("real_agent_mcp_server"):
        return

    monkeypatch.setattr(
        "phoenix.server.app.build_phoenix_mcp_server", lambda *_, **__: (None, None)
    )


@pytest.fixture(autouse=True)
def _mcp_mount_off(monkeypatch: pytest.MonkeyPatch) -> None:
    """Building the ``/mcp`` mount derives a FastMCP server from the app's
    OpenAPI document, about half a second per app. Off suite-wide; the MCP
    tests patch ``get_env_enable_mcp_server`` on, which wins over the env var."""
    monkeypatch.setenv("PHOENIX_ENABLE_MCP_SERVER", "false")


class OfflineDocsMCPServer(MintlifyDocsMCPServer):
    """``MintlifyDocsMCPServer`` with the MCP transport short-circuited.

    Overrides ``get_tools`` to return an empty tool dict and the async
    context-manager protocol to no-op, so neither app startup nor an agent
    run opens an HTTP session to the Mintlify endpoint.
    """

    async def get_tools(self, ctx: RunContext[Any]) -> dict[str, Any]:
        return {}

    async def __aenter__(self) -> "OfflineDocsMCPServer":
        return self

    async def __aexit__(self, *args: object) -> None:
        return None


@pytest.fixture(autouse=True)
def _stub_docs_mcp_server(request: FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    """The agent assistant and external resources default on, so every app
    builds the docs MCP toolset and lifespan startup opens an HTTPS MCP session
    to the Mintlify host: a network round trip per app, bounded only by the
    client's init deadline. Stubbed suite-wide with the offline toolset; tests
    that need the real transport opt in with ``@pytest.mark.real_docs_mcp_server``."""
    if request.node.get_closest_marker("real_docs_mcp_server"):
        return

    monkeypatch.setattr("phoenix.server.app.MintlifyDocsMCPServer", OfflineDocsMCPServer)


@pytest.fixture(autouse=True)
def _stub_wasm_prefetch(monkeypatch: pytest.MonkeyPatch) -> None:
    """The app lifespan pre-fetches the sandbox WASM binary through a cache
    directory shared by every xdist worker, with a network download on a miss
    -- contention and I/O that do not fit inside asgi_lifespan's 5s startup
    budget. Stubbed suite-wide; the download tests call it directly."""

    async def _skip() -> None:
        return None

    monkeypatch.setattr("phoenix.server.app.prefetch_wasm_binary_if_needed", _skip)


@pytest.fixture(autouse=True)
def _agent_session_sweeper_off(request: FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    """The app's agent-session sweeper makes its first pass concurrently with
    the test body, so a test that seeds a session past its retention cannot
    know whether the pass has already reaped it. Off suite-wide; the sweeper
    tests call ``_sweep`` on their own instance, and a test that needs the
    loop opts in with ``@pytest.mark.real_agent_session_sweeper``."""
    if request.node.get_closest_marker("real_agent_session_sweeper"):
        return

    async def _idle(self: Any) -> None:
        return None

    monkeypatch.setattr(
        "phoenix.server.daemons.agent_session_sweeper.AgentSessionSweeper._run", _idle
    )


@pytest.fixture(autouse=True)
def _stub_model_cost_seeding(request: FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    """App startup syncs the model cost manifest, hundreds of built-in models
    with their token prices, through the ORM, and each test's database then
    discards the rows. Stubbed suite-wide; tests that read built-in models or
    prices through the app opt in with ``@pytest.mark.seeded_model_costs``,
    which leaves the real step in the Facilitator so the rows exist before the
    model store's first fetch is scheduled."""
    if request.node.get_closest_marker("seeded_model_costs"):
        return

    async def _skip(db: DbSessionFactory) -> None:
        return None

    monkeypatch.setattr("phoenix.db.facilitator._ensure_model_costs", _skip)


_DERIVE_ENCRYPTION_KEY = EncryptionService._derive_encryption_key
_DERIVE_REDACTION_KEY = Redactor._derive_key
_MEMOIZED_ENCRYPTION_KEYS: dict[str, bytes] = {}
_MEMOIZED_REDACTION_KEYS: dict[str, bytes] = {}


def _memoized_encryption_key(secret: Optional[SecretStr]) -> bytes:
    plaintext = secret.get_secret_value() if secret is not None else ""
    if plaintext not in _MEMOIZED_ENCRYPTION_KEYS:
        _MEMOIZED_ENCRYPTION_KEYS[plaintext] = _DERIVE_ENCRYPTION_KEY(secret)
    return _MEMOIZED_ENCRYPTION_KEYS[plaintext]


def _memoized_redaction_key(secret: SecretStr) -> bytes:
    plaintext = secret.get_secret_value()
    if plaintext not in _MEMOIZED_REDACTION_KEYS:
        _MEMOIZED_REDACTION_KEYS[plaintext] = _DERIVE_REDACTION_KEY(secret)
    return _MEMOIZED_REDACTION_KEYS[plaintext]


@pytest.fixture(autouse=True)
def _memoized_key_derivation(request: FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    """``EncryptionService`` and ``Redactor`` each derive a Fernet key from the
    secret with 600,000 PBKDF2 rounds, a deliberately slow key stretch that
    every app pays twice at construction. Each derivation is a pure function
    of the secret, so the worker memoizes
    it per secret value: every app after the worker's first gets its keys for
    free, and the keys are identical to the ones the real derivation returns.
    A test that asserts on the derivation itself opts out with
    ``@pytest.mark.real_key_derivation``."""
    if request.node.get_closest_marker("real_key_derivation"):
        return

    monkeypatch.setattr(
        EncryptionService, "_derive_encryption_key", staticmethod(_memoized_encryption_key)
    )
    monkeypatch.setattr(Redactor, "_derive_key", staticmethod(_memoized_redaction_key))


_GraphQLExtensions = Iterable[Union[type[SchemaExtension], Callable[[], SchemaExtension]]]
_MEMOIZED_GRAPHQL_SCHEMAS: dict[tuple[Any, ...], strawberry.Schema] = {}


def _graphql_extension_key(extension: Any) -> Any:
    # Extension classes identify themselves. The app passes its other
    # extensions as lambdas built fresh per app; two such lambdas are
    # equivalent when they share code, defaults, and captured values.
    if isinstance(extension, type):
        return extension
    code = getattr(extension, "__code__", None)
    if code is None:
        return extension
    captured = tuple(cell.cell_contents for cell in (extension.__closure__ or ()))
    return (code, extension.__defaults__, captured)


def _memoized_graphql_schema(extensions: Optional[_GraphQLExtensions] = None) -> strawberry.Schema:
    extension_list = list(extensions or ())
    key = tuple(_graphql_extension_key(extension) for extension in extension_list)
    try:
        schema = _MEMOIZED_GRAPHQL_SCHEMAS.get(key)
    except TypeError:
        return build_graphql_schema(extension_list)
    if schema is None:
        schema = _MEMOIZED_GRAPHQL_SCHEMAS[key] = build_graphql_schema(extension_list)
    return schema


@pytest.fixture(autouse=True)
def _memoized_graphql_schema_build(
    request: FixtureRequest,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Building the Strawberry schema converts every type, field, and enum of
    the API into GraphQL core objects, a full pass over the API per app. The
    schema is a pure function of the extension list, so the worker memoizes
    it per list: every app after the worker's first reuses the same schema
    object. A test that needs its own schema opts out with
    ``@pytest.mark.real_graphql_schema_build``."""
    if request.node.get_closest_marker("real_graphql_schema_build"):
        return

    monkeypatch.setattr("phoenix.server.app.build_graphql_schema", _memoized_graphql_schema)


_BUILD_FASTAPI_TYPE_ADAPTER = fastapi_v2.ModelField.__post_init__
_MEMOIZED_FASTAPI_TYPE_ADAPTERS: dict[tuple[Any, ...], TypeAdapter[Any]] = {}
# A few annotations FastAPI rebuilds per app never compare equal, so the
# cache is bounded rather than left to grow with every app in the worker.
_FASTAPI_TYPE_ADAPTER_CACHE_LIMIT = 4096
# Everything on a pydantic FieldInfo that can change the adapter it yields.
_FIELD_INFO_ATTRIBUTES = (
    "default",
    "default_factory",
    "alias",
    "alias_priority",
    "validation_alias",
    "serialization_alias",
    "title",
    "field_title_generator",
    "description",
    "examples",
    "exclude",
    "exclude_if",
    "discriminator",
    "deprecated",
    "json_schema_extra",
    "frozen",
    "validate_default",
    "repr",
    "init",
    "init_var",
    "kw_only",
)


def _by_value_or_repr(value: Any) -> Any:
    # Hashable values key by type and equality, which for classes and
    # callables is identity, so same-named types and same-named factories
    # stay apart and 0, 0.0, and False do not collide. Unhashable values
    # such as lists and dicts key by repr.
    try:
        hash(value)
    except TypeError:
        return repr(value)
    return (type(value), value)


def _fastapi_type_adapter_key(field: fastapi_v2.ModelField) -> tuple[Any, ...]:
    info = field.field_info
    return (
        field.mode,
        _by_value_or_repr(info.annotation),
        repr(info.metadata),
        *(_by_value_or_repr(getattr(info, name, None)) for name in _FIELD_INFO_ATTRIBUTES),
        repr(field.config),
    )


def _memoized_fastapi_model_field_post_init(self: fastapi_v2.ModelField) -> None:
    key = _fastapi_type_adapter_key(self)
    adapter = _MEMOIZED_FASTAPI_TYPE_ADAPTERS.get(key)
    if adapter is None:
        _BUILD_FASTAPI_TYPE_ADAPTER(self)
        if len(_MEMOIZED_FASTAPI_TYPE_ADAPTERS) < _FASTAPI_TYPE_ADAPTER_CACHE_LIMIT:
            _MEMOIZED_FASTAPI_TYPE_ADAPTERS[key] = self._type_adapter
    else:
        self._type_adapter = adapter


@pytest.fixture(autouse=True)
def _memoized_fastapi_type_adapters(
    request: FixtureRequest,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """FastAPI rebuilds every route for each app that includes its router, and
    each route's parameters and response model become ModelFields whose
    ``__post_init__`` builds a pydantic TypeAdapter, a core schema generated
    per field per app. An adapter is a pure function of the field's mode,
    annotation, FieldInfo, and config, and is stateless once built, so the
    worker memoizes them: every app after the worker's first reuses them. A
    test that needs fresh adapters opts out with
    ``@pytest.mark.real_fastapi_type_adapters``."""
    if request.node.get_closest_marker("real_fastapi_type_adapters"):
        return

    monkeypatch.setattr(
        fastapi_v2.ModelField, "__post_init__", _memoized_fastapi_model_field_post_init
    )


# The auth router is left out: its builder reads environment flags at
# construction, so it is not a function of its arguments alone.
_ROUTER_BUILDER_NAMES = (
    "create_v1_router",
    "create_agents_router",
    "create_legacy_agents_router",
)
_REAL_ROUTER_BUILDERS: dict[str, Callable[..., APIRouter]] = {
    name: getattr(server_app, name) for name in _ROUTER_BUILDER_NAMES
}
_MEMOIZED_ROUTERS: dict[tuple[Any, ...], APIRouter] = {}


def _memoized_router_builder(name: str) -> Callable[..., APIRouter]:
    build = _REAL_ROUTER_BUILDERS[name]

    def memoized(*args: Any, **kwargs: Any) -> APIRouter:
        key = (name, args, tuple(sorted(kwargs.items())))
        router = _MEMOIZED_ROUTERS.get(key)
        if router is None:
            router = _MEMOIZED_ROUTERS[key] = build(*args, **kwargs)
        return router

    return memoized


@pytest.fixture(autouse=True)
def _memoized_app_routers(request: FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    """``create_app`` builds the v1, agents, and legacy-agents routers per
    app from a flag, and building a router registers every route, inspecting
    its signature and modelling its fields before the app even includes it.
    Each of those routers is a pure function of its flag, and including one
    records it on the app without mutating it, so the worker memoizes each
    builder per argument list: every app after the worker's first reuses the
    routers. A test that needs its own routers opts out with
    ``@pytest.mark.real_app_routers``."""
    if request.node.get_closest_marker("real_app_routers"):
        return

    for name in _ROUTER_BUILDER_NAMES:
        monkeypatch.setattr(server_app, name, _memoized_router_builder(name))


@pytest.fixture(autouse=True)
def _widened_app_lifespan_budgets(monkeypatch: pytest.MonkeyPatch) -> None:
    """asgi_lifespan's default five-second budgets are routinely exceeded by
    app startup under full worker contention: setups measure eight seconds and
    more at the tail of the suite. Several test modules construct
    LifespanManager directly, so the default is widened once here; explicit
    arguments still win, and the per-test timeout bounds a genuine hang."""
    original = LifespanManager.__init__

    def widened(self: Any, app: Any, *args: Any, **kwargs: Any) -> None:
        if not args:
            kwargs.setdefault("startup_timeout", 30)
            kwargs.setdefault("shutdown_timeout", 30)
        original(self, app, *args, **kwargs)

    monkeypatch.setattr(LifespanManager, "__init__", widened)


def pytest_collection_modifyitems(config: Config, items: list[Any]) -> None:
    db = config.getoption("--db")
    if db == "sqlite":
        skip_marker = pytest.mark.skip(reason="Skipping Postgres tests (--db sqlite)")
        for item in items:
            if item.get_closest_marker("postgres_only") is not None:
                item.add_marker(skip_marker)
                continue
            if "dialect" in item.fixturenames:
                if "postgresql" in item.callspec.params.values():
                    item.add_marker(skip_marker)
    elif db == "postgresql":
        skip_marker = pytest.mark.skip(reason="Skipping SQLite tests (--db postgresql)")
        for item in items:
            if "dialect" in item.fixturenames:
                if "sqlite" in item.callspec.params.values():
                    item.add_marker(skip_marker)


@pytest.fixture
def pydantic_version() -> Literal["v1", "v2"]:
    raw_version = version("pydantic")
    major_version = int(raw_version.split(".")[0])
    if major_version == 1:
        return "v1"
    if major_version == 2:
        return "v2"
    raise ValueError(f"Cannot parse pydantic version: {raw_version}")


@pytest.fixture
def openai_api_key(monkeypatch: pytest.MonkeyPatch) -> str:
    api_key = "sk-0123456789"
    monkeypatch.setenv("OPENAI_API_KEY", api_key)
    return api_key


@pytest.fixture
def anthropic_api_key(monkeypatch: pytest.MonkeyPatch) -> str:
    api_key = "sk-0123456789"
    monkeypatch.setenv("ANTHROPIC_API_KEY", api_key)
    return api_key


@pytest.fixture(scope="session")
def _postgresql_template_db(postgresql_proc: Any) -> Iterator[str]:
    """Create a template database with the full schema once per session.

    Per-test databases are cloned from this template via CREATE DATABASE ... TEMPLATE,
    which is a fast file-copy at the PG level (~5ms) instead of running create_all DDL
    (~30-44ms) per test.
    """

    template_name = f"phoenix_template_{os.getpid()}"
    janitor = DatabaseJanitor(
        user=postgresql_proc.user,
        host=postgresql_proc.host,
        port=postgresql_proc.port,
        version=postgresql_proc.version,
        dbname=template_name,
        password=postgresql_proc.password or None,
    )
    janitor.init()
    sync_url = URL.create(
        "postgresql+psycopg",
        username=postgresql_proc.user,
        password=postgresql_proc.password or None,
        host=postgresql_proc.host,
        port=postgresql_proc.port,
        database=template_name,
    )
    sync_engine = sqlalchemy.create_engine(sync_url)
    models.Base.metadata.create_all(sync_engine)
    sync_engine.dispose()
    async_url = URL.create(
        "postgresql+asyncpg",
        username=postgresql_proc.user,
        password=postgresql_proc.password or None,
        host=postgresql_proc.host,
        port=postgresql_proc.port,
        database=template_name,
    )
    _seed_template_database(lambda: aio_postgresql_engine(async_url, migrate=False), "postgresql")
    yield template_name
    janitor.drop()


@pytest.fixture(scope="function")
async def postgresql_engine(
    request: SubRequest,
    postgresql_proc: Any,
    _postgresql_template_db: str,
) -> AsyncIterator[AsyncEngine]:
    # A pristine database is created from scratch with the schema only,
    # instead of cloned from the seeded template.
    pristine = request.node.get_closest_marker("pristine_db") is not None
    dbname = f"phoenix_test_{os.getpid()}_{token_hex(4)}"
    janitor = DatabaseJanitor(
        user=postgresql_proc.user,
        host=postgresql_proc.host,
        port=postgresql_proc.port,
        version=postgresql_proc.version,
        dbname=dbname,
        password=postgresql_proc.password or None,
        template_dbname=None if pristine else _postgresql_template_db,
    )
    janitor.init()
    url = URL.create(
        "postgresql+asyncpg",
        username=postgresql_proc.user,
        password=postgresql_proc.password or None,
        host=postgresql_proc.host,
        port=postgresql_proc.port,
        database=dbname,
    )
    engine = aio_postgresql_engine(url, migrate=False)
    if pristine:
        async with engine.begin() as conn:
            await conn.run_sync(models.Base.metadata.create_all)
    yield engine
    await engine.dispose()
    janitor.drop()


@pytest.fixture(params=["sqlite", "postgresql"])
def dialect(request: SubRequest) -> str:
    return str(request.param)


@pytest.fixture
def sqlalchemy_dialect(dialect: str) -> Any:
    if dialect == "sqlite":
        return sqlite.dialect()
    elif dialect == "postgresql":
        return postgresql.dialect()  # type: ignore[no-untyped-call]
    else:
        raise ValueError(f"Unsupported dialect: {dialect}")


def _seed_template_database(make_engine: Callable[[], AsyncEngine], dialect: str) -> None:
    """Run the app's startup seeding once against a template database, so the
    Facilitator every app runs at startup finds its rows already in place and
    each of its steps is a read or a delete that matches nothing. The model
    cost manifest is left out: the suite stubs that step, and a test opts into
    it per app.

    The seeding runs on its own thread with its own event loop, because the
    template fixtures are synchronous and pytest-asyncio owns the calling
    thread's loop."""

    async def skip_model_costs(db: DbSessionFactory) -> None:
        return None

    async def seed() -> None:
        engine = make_engine()
        try:
            db = DbSessionFactory(db=_db(engine), dialect=dialect)
            with pytest.MonkeyPatch.context() as mp:
                mp.setattr("phoenix.db.facilitator._ensure_model_costs", skip_model_costs)
                await Facilitator(db=db)()
        finally:
            await engine.dispose()

    failure: list[BaseException] = []

    def run() -> None:
        try:
            asyncio.run(seed())
        except BaseException as exc:
            failure.append(exc)

    thread = threading.Thread(target=run, name=f"seed-{dialect}-template")
    thread.start()
    thread.join()
    if failure:
        raise failure[0]


def _named_memory_sqlite_engine(uri: str) -> AsyncEngine:
    """An async engine on a named shared-cache in-memory SQLite database."""

    def async_creator() -> aiosqlite.Connection:
        conn = aiosqlite.Connection(
            lambda: sqlean.connect(uri, uri=True),
            iter_chunk_size=64,
        )
        # aiosqlite>=0.22 moved the worker to Connection._thread; SQLAlchemy's
        # aiosqlite dialect daemonizes it only when it creates the connection
        # itself, not when an async_creator is used.
        conn._thread.daemon = True
        return conn

    engine = create_async_engine(
        url="sqlite+aiosqlite://",
        async_creator=async_creator,
        poolclass=StaticPool,
        json_serializer=_json_serializer,
    )
    sqlalchemy.event.listen(engine.sync_engine, "connect", set_sqlite_pragma)
    return engine


@pytest.fixture(scope="session")
def _sqlite_schema_db() -> Iterator[str]:
    """Create and seed the schema once per session in a named in-memory
    SQLite database."""
    db_name = f"phoenix_test_{os.getpid()}"
    uri = f"file:{db_name}?mode=memory&cache=shared"
    # Keeper connection keeps the named in-memory DB alive for the session
    keeper = sqlean.connect(uri, uri=True)
    sync_engine = sqlalchemy.create_engine(
        "sqlite://",
        creator=lambda: sqlean.connect(uri, uri=True),
    )
    models.Base.metadata.create_all(sync_engine)
    _seed_template_database(lambda: _named_memory_sqlite_engine(uri), "sqlite")
    yield db_name
    sync_engine.dispose()
    keeper.close()


@pytest.fixture(scope="function")
async def sqlite_engine(
    request: SubRequest,
    tmp_path_factory: TempPathFactory,
    _sqlite_schema_db: str,
) -> AsyncIterator[AsyncEngine]:
    config = request.config
    if config.getoption("--sqlite-on-disk"):
        # Fall back to per-test DB for on-disk debugging
        url = URL.create("sqlite+aiosqlite")
        db_file = tmp_path_factory.mktemp("sqlite") / f"_{token_hex(8)}.db"
        print(f"SQLite file: {db_file}")
        url = url.set(database=str(db_file))
        engine = aio_sqlite_engine(url, migrate=False)
        async with engine.begin() as conn:
            await conn.run_sync(models.Base.metadata.drop_all)
            await conn.run_sync(models.Base.metadata.create_all)
        if not request.node.get_closest_marker("pristine_db"):
            _seed_template_database(lambda: aio_sqlite_engine(url, migrate=False), "sqlite")
        yield engine
        await engine.dispose()
    elif request.node.get_closest_marker("pristine_db"):
        # A private, unseeded database: the schema only.
        uri = f"file:phoenix_pristine_{os.getpid()}_{token_hex(4)}?mode=memory&cache=shared"
        keeper = sqlean.connect(uri, uri=True)
        sync_engine = sqlalchemy.create_engine(
            "sqlite://", creator=lambda: sqlean.connect(uri, uri=True)
        )
        models.Base.metadata.create_all(sync_engine)
        engine = _named_memory_sqlite_engine(uri)
        yield engine
        await engine.dispose()
        sync_engine.dispose()
        keeper.close()
    else:
        db_name = _sqlite_schema_db
        uri = f"file:{db_name}?mode=memory&cache=shared"
        engine = _named_memory_sqlite_engine(uri)
        yield engine
        await engine.dispose()


@pytest.fixture(scope="function")
async def _sqlite_test_conn(
    sqlite_engine: AsyncEngine,
) -> AsyncIterator[AsyncConnection]:
    """Open a connection with a SAVEPOINT so each test's data is rolled back."""
    conn = await sqlite_engine.connect()
    txn = await conn.begin()
    await conn.begin_nested()
    yield conn
    # Roll back the outer transaction to undo all data changes, including
    # any nested SAVEPOINTs that may have been released or rolled back during the test.
    # Wrap in try/except because error-path tests may leave the connection in a
    # closed or otherwise unusable state.
    try:
        if txn.is_active:
            await txn.rollback()
    except Exception:
        pass
    try:
        await conn.close()
    except Exception:
        pass


def _serialized(
    factory: Callable[[], contextlib.AbstractAsyncContextManager[AsyncSession]],
) -> Callable[[], contextlib.AbstractAsyncContextManager[AsyncSession]]:
    """Give sessions exclusive use of the connection these fixtures share.

    Tests bind every session to one `AsyncConnection` held open under a
    transaction and savepoint, so a test rolls back wholesale. Concurrent
    sessions would then interleave transaction boundaries on a connection none
    of them owns, and one rollback would remove a savepoint another still
    needs.

    Production shares nothing: its pool hands out a connection per checkout, so
    the serialisation belongs to the fixture that creates the sharing.
    """
    lock = asyncio.Lock()

    @contextlib.asynccontextmanager
    async def serialized() -> AsyncIterator[AsyncSession]:
        async with lock:
            async with factory() as session:
                yield session

    return serialized


@pytest.fixture(scope="function")
def db(
    request: SubRequest,
    dialect: str,
) -> DbSessionFactory:
    if dialect == "sqlite":
        conn = request.getfixturevalue("_sqlite_test_conn")
        return DbSessionFactory(db=_serialized(_db(conn)), dialect=dialect)
    elif dialect == "postgresql":
        engine = request.getfixturevalue("postgresql_engine")
        return DbSessionFactory(db=_db(engine), dialect=dialect)
    else:
        raise ValueError(f"Unknown db fixture: {dialect}")


@pytest.fixture
async def synced_builtin_evaluators(db: DbSessionFactory) -> None:
    """Ensure builtin evaluators are synced to the database.

    Tests that directly create DatasetEvaluators referencing builtin evaluators
    should use this fixture to ensure the builtin evaluators exist in the database.
    """
    from phoenix.server.api.builtin_evaluator_sync import sync_builtin_evaluators

    await sync_builtin_evaluators(db)


@pytest.fixture
async def project(db: DbSessionFactory) -> None:
    project = models.Project(name="test_project")
    async with db() as session:
        session.add(project)


@pytest.fixture
async def app(
    db: DbSessionFactory,
) -> AsyncIterator[FastAPI]:
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        yield create_app(
            db=db,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
        )


@pytest.fixture
async def asgi_app(app: FastAPI) -> AsyncIterator[ASGIApp]:
    async with LifespanManager(app) as manager:
        yield manager.app


@pytest.fixture
def httpx_client(
    asgi_app: ASGIApp,
) -> httpx.AsyncClient:
    asgi_transport = httpx.ASGITransport(app=asgi_app)
    return httpx.AsyncClient(transport=asgi_transport, base_url="http://test")


@pytest.fixture
def gql_client(httpx_client: httpx.AsyncClient) -> Iterator[AsyncGraphQLClient]:
    yield AsyncGraphQLClient(httpx_client)


@pytest.fixture
def acall(loop: AbstractEventLoop) -> Callable[..., Awaitable[Any]]:
    return lambda f, *_, **__: loop.run_in_executor(None, partial(f, *_, **__))


@contextlib.asynccontextmanager
async def patch_grpc_server() -> AsyncIterator[None]:
    cls = GrpcServer
    original = cls.__init__
    name = original.__name__
    changes = {"disabled": True}
    setattr(cls, name, lambda *_, **__: original(*_, **{**__, **changes}))
    yield
    setattr(cls, name, original)


class TestBulkInserter(BulkInserter):
    __test__ = False

    async def __aenter__(
        self,
    ) -> tuple[
        Callable[..., Awaitable[None]],
        Callable[[Span, str], Awaitable[None]],
        Callable[[DataManipulation], None],
    ]:
        if self._spans:
            await self._insert_spans(len(self._spans))
        # Return the overridden methods
        return (
            self._enqueue_annotations_immediate,
            self._queue_span_immediate,
            self._enqueue_operation_immediate,
        )

    async def __aexit__(self, *args: Any) -> None:
        # No background tasks to cancel
        pass

    async def _enqueue_annotations_immediate(self, *items: Any) -> None:
        # Process items immediately
        await self._queue_inserters.enqueue(*items)
        async for event in self._queue_inserters.insert():
            self._event_queue.put(event)

    def _enqueue_operation_immediate(self, operation: DataManipulation) -> None:
        raise NotImplementedError

    async def _queue_span_immediate(self, span: Span, project_name: str) -> None:
        self._spans.append((span, project_name))
        await self._insert_spans(1)


@contextlib.asynccontextmanager
async def patch_batched_caller() -> AsyncIterator[None]:
    cls = BatchedCaller
    original = cls.__init__
    name = original.__name__
    changes = {"sleep_seconds": 0.001}
    setattr(cls, name, lambda *_, **__: original(*_, **{**__, **changes}))
    yield
    setattr(cls, name, original)


@pytest.fixture
def fake() -> Faker:
    return Faker()


@pytest.fixture
def rand_span_id() -> Iterator[str]:
    def _(seen: set[str]) -> Iterator[str]:
        while True:
            span_id = getrandbits(64).to_bytes(8, "big").hex()
            if span_id not in seen:
                seen.add(span_id)
                yield span_id

    return _(set())


@pytest.fixture
def rand_trace_id() -> Iterator[str]:
    def _(seen: set[str]) -> Iterator[str]:
        while True:
            span_id = getrandbits(128).to_bytes(16, "big").hex()
            if span_id not in seen:
                seen.add(span_id)
                yield span_id

    return _(set())


@pytest.fixture
def custom_vcr(request: FixtureRequest) -> CustomVCR:
    return CustomVCR(request)
