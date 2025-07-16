import asyncio
import contextlib
from asyncio import AbstractEventLoop
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from functools import partial
from importlib.metadata import version
from random import getrandbits
from secrets import token_hex
from typing import Any, Literal

import httpx
import pytest
from _pytest.config import Config
from _pytest.fixtures import SubRequest
from _pytest.terminal import TerminalReporter
from _pytest.tmpdir import TempPathFactory
from asgi_lifespan import LifespanManager
from faker import Faker
from httpx import AsyncByteStream, Request, Response
from psycopg import Connection
from pytest import FixtureRequest
from pytest_postgresql import factories
from sqlalchemy import URL, make_url
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncEngine
from starlette.types import ASGIApp

import phoenix.trace.v1 as pb
from phoenix.client import Client
from phoenix.config import EXPORT_DIR
from phoenix.core.model_schema_adapter import create_model_from_inferences
from phoenix.db import models
from phoenix.db.bulk_inserter import BulkInserter
from phoenix.db.engines import aio_postgresql_engine, aio_sqlite_engine
from phoenix.db.insertion.helpers import DataManipulation
from phoenix.inferences.inferences import EMPTY_INFERENCES
from phoenix.pointcloud.umap_parameters import get_umap_parameters
from phoenix.server.app import _db, create_app
from phoenix.server.grpc_server import GrpcServer
from phoenix.server.types import BatchedCaller, DbSessionFactory
from phoenix.session.client import Client as LegacyClient
from phoenix.trace.schemas import Span
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.transport import ASGIWebSocketTransport
from tests.unit.vcr import CustomVCR


def pytest_terminal_summary(
    terminalreporter: TerminalReporter, exitstatus: int, config: Config
) -> None:
    xfails = len([x for x in terminalreporter.stats.get("xfailed", [])])
    xpasses = len([x for x in terminalreporter.stats.get("xpassed", [])])

    xfail_threshold = 12  # our tests are currently quite unreliable

    if config.getoption("--run-postgres"):
        terminalreporter.write_sep("=", f"xfail threshold: {xfail_threshold}")
        terminalreporter.write_sep("=", f"xpasses: {xpasses}, xfails: {xfails}")

        if exitstatus == pytest.ExitCode.OK:
            if xfails < xfail_threshold:
                terminalreporter.write_sep(
                    "=", "Within xfail threshold. Passing the test suite.", green=True
                )
                assert terminalreporter._session is not None
                terminalreporter._session.exitstatus = pytest.ExitCode.OK
            else:
                terminalreporter.write_sep(
                    "=", "Too many flaky tests. Failing the test suite.", red=True
                )
                assert terminalreporter._session is not None
                terminalreporter._session.exitstatus = pytest.ExitCode.TESTS_FAILED


def pytest_collection_modifyitems(config: Config, items: list[Any]) -> None:
    skip_postgres = pytest.mark.skip(reason="Skipping Postgres tests")
    if not config.getoption("--run-postgres"):
        for item in items:
            if "dialect" in item.fixturenames:
                if "postgresql" in item.callspec.params.values():
                    item.add_marker(skip_postgres)


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


postgresql_connection = factories.postgresql("postgresql_proc")


@pytest.fixture(scope="function")
async def postgresql_url(postgresql_connection: "Connection[Any]") -> AsyncIterator[URL]:
    connection = postgresql_connection
    user = connection.info.user
    password = connection.info.password
    database = connection.info.dbname
    host = connection.info.host
    port = connection.info.port
    yield make_url(f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}")


@pytest.fixture(scope="function")
async def postgresql_engine(postgresql_url: URL) -> AsyncIterator[AsyncEngine]:
    engine = aio_postgresql_engine(postgresql_url, migrate=False)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.drop_all)
        await conn.run_sync(models.Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture(params=["sqlite", "postgresql"])
def dialect(request: SubRequest) -> str:
    return str(request.param)


@pytest.fixture
def sqlalchemy_dialect(dialect: str) -> Any:
    if dialect == "sqlite":
        return sqlite.dialect()  # type: ignore[no-untyped-call]
    elif dialect == "postgresql":
        return postgresql.dialect()  # type: ignore[no-untyped-call]
    else:
        raise ValueError(f"Unsupported dialect: {dialect}")


@pytest.fixture(scope="function")
async def sqlite_engine(
    request: SubRequest,
    tmp_path_factory: TempPathFactory,
) -> AsyncIterator[AsyncEngine]:
    config = request.config
    url = URL.create("sqlite+aiosqlite")
    if config.getoption("--sqlite-on-disk"):
        db_file = tmp_path_factory.mktemp("sqlite") / f"_{token_hex(8)}.db"
        print(f"SQLite file: {db_file}")
        url = url.set(database=str(db_file))
    else:
        url = url.set(database=":memory:")
    engine = aio_sqlite_engine(url, migrate=False)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.drop_all)
        await conn.run_sync(models.Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture(scope="function")
def db(
    request: SubRequest,
    dialect: str,
) -> DbSessionFactory:
    if dialect == "sqlite":
        engine = request.getfixturevalue("sqlite_engine")
    elif dialect == "postgresql":
        engine = request.getfixturevalue("postgresql_engine")
    else:
        raise ValueError(f"Unknown db fixture: {dialect}")
    return DbSessionFactory(db=_db(engine), dialect=dialect)


@pytest.fixture
async def project(db: DbSessionFactory) -> None:
    project = models.Project(name="test_project")
    async with db() as session:
        session.add(project)


@pytest.fixture
async def app(
    db: DbSessionFactory,
) -> AsyncIterator[ASGIApp]:
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            model=create_model_from_inferences(EMPTY_INFERENCES, None),
            authentication_enabled=False,
            export_path=EXPORT_DIR,
            umap_params=get_umap_parameters(None),
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
        )
        manager = await stack.enter_async_context(LifespanManager(app))
        yield manager.app


@pytest.fixture
def httpx_clients(
    app: ASGIApp,
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

    asgi_transport = ASGIWebSocketTransport(app=app)
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
            self._enqueue_immediate,
            self._queue_span_immediate,
            self._queue_evaluation_immediate,
            self._enqueue_operation_immediate,
        )

    async def __aexit__(self, *args: Any) -> None:
        # No background tasks to cancel
        pass

    async def _enqueue_immediate(self, *items: Any) -> None:
        # Process items immediately
        await self._queue_inserters.enqueue(*items)
        async for event in self._queue_inserters.insert():
            self._event_queue.put(event)

    def _enqueue_operation_immediate(self, operation: DataManipulation) -> None:
        raise NotImplementedError

    async def _queue_span_immediate(self, span: Span, project_name: str) -> None:
        await self._insert_spans([(span, project_name)])

    async def _queue_evaluation_immediate(self, evaluation: pb.Evaluation) -> None:
        await self._insert_evaluations([evaluation])


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
