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
from pytest import FixtureRequest
from pytest_postgresql.janitor import DatabaseJanitor
from sqlalchemy import URL, StaticPool
from sqlalchemy.dialects import mysql, postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine
from starlette.types import ASGIApp

from phoenix.db import models
from phoenix.db.bulk_inserter import BulkInserter
from phoenix.db.engines import (
    _dumps as _json_serializer,
)
from phoenix.db.engines import (
    aio_mysql_engine,
    aio_postgresql_engine,
    aio_sqlite_engine,
    set_sqlite_pragma,
)
from phoenix.db.insertion.helpers import DataManipulation
from phoenix.server.app import _db, create_app
from phoenix.server.grpc_server import GrpcServer
from phoenix.server.types import BatchedCaller, DbSessionFactory
from phoenix.trace.schemas import Span
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.vcr import CustomVCR


def pytest_collection_modifyitems(config: Config, items: list[Any]) -> None:
    db = config.getoption("--db")
    if db == "sqlite":
        skip_marker = pytest.mark.skip(reason="Skipping Postgres tests (--db sqlite)")
        for item in items:
            if _is_dialect_item(item) and _item_uses_any_dialect(item, "postgresql", "mysql"):
                item.add_marker(skip_marker)
    elif db == "postgresql":
        skip_marker = pytest.mark.skip(reason="Skipping non-Postgres tests (--db postgresql)")
        for item in items:
            if _is_dialect_item(item) and not _item_uses_any_dialect(item, "postgresql"):
                item.add_marker(skip_marker)
    elif db == "mysql":
        skip_marker = pytest.mark.skip(reason="Skipping non-MySQL tests (--db mysql)")
        incompatible_marker = pytest.mark.skip(
            reason="Skipping tests not marked mysql_compatible (--db mysql)"
        )
        for item in items:
            if not _is_dialect_item(item):
                continue
            if not _item_uses_any_dialect(item, "mysql"):
                item.add_marker(skip_marker)
            elif not _is_mysql_compatible(item):
                item.add_marker(incompatible_marker)
    elif db == "all":
        incompatible_marker = pytest.mark.skip(
            reason="Skipping MySQL tests not marked mysql_compatible (--db all)"
        )
        for item in items:
            if (
                _is_dialect_item(item)
                and _item_uses_any_dialect(item, "mysql")
                and not _is_mysql_compatible(item)
            ):
                item.add_marker(incompatible_marker)


def _is_dialect_item(item: Any) -> bool:
    return "dialect" in item.fixturenames and hasattr(item, "callspec")


def _item_uses_any_dialect(item: Any, *dialects: str) -> bool:
    return any(dialect in item.callspec.params.values() for dialect in dialects)


def _is_mysql_compatible(item: Any) -> bool:
    return item.get_closest_marker("mysql_compatible") is not None


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


@pytest.fixture(scope="function")
async def mysql_engine() -> AsyncIterator[AsyncEngine]:
    url = URL.create("mysql+aiomysql")
    if raw_url := os.getenv("CI_TEST_MYSQL_DATABASE_URL"):
        url = sqlalchemy.make_url(raw_url).set(drivername="mysql+aiomysql")
    else:
        url = URL.create(
            "mysql+aiomysql",
            username="root",
            host="127.0.0.1",
            port=3306,
            database="phoenix",
        )
    engine = aio_mysql_engine(url, migrate=False)
    await _drop_mysql_tables(engine)
    async with engine.connect() as conn:
        await conn.run_sync(_create_mysql_tables)
    yield engine
    await _drop_mysql_tables(engine)
    await engine.dispose()


def _create_mysql_tables(conn: Any) -> None:
    # Keep each table visible before creating dependent foreign keys.
    for table in models.Base.metadata.sorted_tables:
        table.create(conn, checkfirst=True)
        conn.commit()


async def _drop_mysql_tables(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.execute(sqlalchemy.text("SET FOREIGN_KEY_CHECKS = 0"))
        tables = await conn.execute(
            sqlalchemy.text(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                """
            )
        )
        for (table_name,) in tables:
            await conn.execute(sqlalchemy.text(f"DROP TABLE IF EXISTS `{table_name}`"))
        await conn.execute(sqlalchemy.text("SET FOREIGN_KEY_CHECKS = 1"))


@pytest.fixture(params=["sqlite", "postgresql", "mysql"])
def dialect(request: SubRequest) -> str:
    return str(request.param)


@pytest.fixture
def sqlalchemy_dialect(dialect: str) -> Any:
    if dialect == "sqlite":
        return sqlite.dialect()
    elif dialect == "postgresql":
        return postgresql.dialect()  # type: ignore[no-untyped-call]
    elif dialect == "mysql":
        return mysql.dialect()  # type: ignore[no-untyped-call]
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
    elif dialect == "mysql":
        engine = request.getfixturevalue("mysql_engine")
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
