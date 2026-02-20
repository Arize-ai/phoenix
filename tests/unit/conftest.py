import asyncio
import contextlib
import os
from asyncio import AbstractEventLoop
from functools import partial
from importlib.metadata import version
from random import getrandbits
from secrets import token_hex
from typing import Any, AsyncIterator, Awaitable, Callable, Iterator, Literal

import aiosqlite
import httpx
import pytest
import sqlalchemy
import sqlean
from _pytest.config import Config
from _pytest.fixtures import SubRequest
from _pytest.tmpdir import TempPathFactory
from asgi_lifespan import LifespanManager
from faker import Faker
from fastapi import FastAPI
from httpx import AsyncByteStream, Request, Response
from pytest import FixtureRequest
from pytest_postgresql.janitor import DatabaseJanitor
from sqlalchemy import URL, StaticPool
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine
from starlette.types import ASGIApp

import phoenix.trace.v1 as pb
from phoenix.client import Client
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
from phoenix.db.insertion.helpers import DataManipulation
from phoenix.server.app import _db, create_app
from phoenix.server.grpc_server import GrpcServer
from phoenix.server.types import BatchedCaller, DbSessionFactory
from phoenix.session.client import Client as LegacyClient
from phoenix.trace.schemas import Span
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.transport import ASGIWebSocketTransport
from tests.unit.vcr import CustomVCR


def pytest_collection_modifyitems(config: Config, items: list[Any]) -> None:
    db = config.getoption("--db")
    if db == "sqlite":
        skip_marker = pytest.mark.skip(reason="Skipping Postgres tests (--db sqlite)")
        for item in items:
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
    yield template_name
    janitor.drop()


@pytest.fixture(scope="function")
async def postgresql_engine(
    postgresql_proc: Any,
    _postgresql_template_db: str,
) -> AsyncIterator[AsyncEngine]:
    dbname = f"phoenix_test_{os.getpid()}_{token_hex(4)}"
    janitor = DatabaseJanitor(
        user=postgresql_proc.user,
        host=postgresql_proc.host,
        port=postgresql_proc.port,
        version=postgresql_proc.version,
        dbname=dbname,
        password=postgresql_proc.password or None,
        template_dbname=_postgresql_template_db,
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


@pytest.fixture(scope="session")
def _sqlite_schema_db() -> Iterator[str]:
    """Create the schema once per session in a named in-memory SQLite database."""
    db_name = f"phoenix_test_{os.getpid()}"
    uri = f"file:{db_name}?mode=memory&cache=shared"
    # Keeper connection keeps the named in-memory DB alive for the session
    keeper = sqlean.connect(uri, uri=True)
    sync_engine = sqlalchemy.create_engine(
        "sqlite://",
        creator=lambda: sqlean.connect(uri, uri=True),
    )
    models.Base.metadata.create_all(sync_engine)
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
        yield engine
        await engine.dispose()
    else:
        db_name = _sqlite_schema_db
        uri = f"file:{db_name}?mode=memory&cache=shared"

        def async_creator() -> aiosqlite.Connection:
            conn = aiosqlite.Connection(
                lambda: sqlean.connect(uri, uri=True),
                iter_chunk_size=64,
            )
            conn.daemon = True
            return conn

        engine = create_async_engine(
            url="sqlite+aiosqlite://",
            async_creator=async_creator,
            poolclass=StaticPool,
            json_serializer=_json_serializer,
        )
        sqlalchemy.event.listen(engine.sync_engine, "connect", set_sqlite_pragma)
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


@pytest.fixture(scope="function")
def db(
    request: SubRequest,
    dialect: str,
) -> DbSessionFactory:
    if dialect == "sqlite":
        conn = request.getfixturevalue("_sqlite_test_conn")
        return DbSessionFactory(db=_db(conn), dialect=dialect)
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
def httpx_clients(
    asgi_app: ASGIApp,
) -> tuple[httpx.Client, httpx.AsyncClient]:
    class Transport(httpx.BaseTransport):
        def __init__(self, asgi_transport: ASGIWebSocketTransport) -> None:
            import nest_asyncio

            nest_asyncio.apply()

            self.asgi_transport = asgi_transport

        def handle_request(self, request: Request) -> Response:
            response = asyncio.run(self.asgi_transport.handle_async_request(request))

            async def read_stream() -> bytes:
                content = b""
                assert isinstance(stream := response.stream, AsyncByteStream)
                async for chunk in stream:
                    content += chunk
                return content

            content = asyncio.run(read_stream())
            return Response(
                status_code=response.status_code,
                headers=response.headers,
                content=content,
                request=request,
            )

    asgi_transport = ASGIWebSocketTransport(app=asgi_app)
    transport = Transport(asgi_transport=asgi_transport)
    base_url = "http://test"
    return (
        httpx.Client(transport=transport, base_url=base_url),
        httpx.AsyncClient(transport=asgi_transport, base_url=base_url),
    )


@pytest.fixture
def httpx_client(
    httpx_clients: tuple[httpx.Client, httpx.AsyncClient],
) -> httpx.AsyncClient:
    return httpx_clients[1]


@pytest.fixture
def gql_client(httpx_client: httpx.AsyncClient) -> Iterator[AsyncGraphQLClient]:
    yield AsyncGraphQLClient(httpx_client)


@pytest.fixture
def legacy_px_client(
    httpx_clients: tuple[httpx.Client, httpx.AsyncClient],
) -> LegacyClient:
    sync_client, _ = httpx_clients
    client = LegacyClient(warn_if_server_not_running=False)
    client._client = sync_client  # type: ignore[assignment]
    return client


@pytest.fixture
def px_client(
    httpx_clients: tuple[httpx.Client, httpx.AsyncClient],
) -> Client:
    sync_client, _ = httpx_clients
    return Client(http_client=sync_client)


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
    async def __aenter__(
        self,
    ) -> tuple[
        Callable[..., Awaitable[None]],
        Callable[[Span, str], Awaitable[None]],
        Callable[[pb.Evaluation], Awaitable[None]],
        Callable[[DataManipulation], None],
    ]:
        # Return the overridden methods
        return (
            self._enqueue_annotations_immediate,
            self._queue_span_immediate,
            self._queue_evaluation_immediate,
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

    async def _queue_evaluation_immediate(self, evaluation: pb.Evaluation) -> None:
        self._evaluations.append(evaluation)
        await self._insert_evaluations(1)


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
