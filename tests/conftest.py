import asyncio
import contextlib
from asyncio import AbstractEventLoop, get_running_loop
from functools import partial
from importlib.metadata import version
from time import sleep
from typing import (
    Any,
    AsyncContextManager,
    AsyncIterator,
    Awaitable,
    Callable,
    List,
    Literal,
    Tuple,
)

import httpx
import pytest
from _pytest.config import Config, Parser
from _pytest.fixtures import SubRequest
from asgi_lifespan import LifespanManager
from httpx import URL, Request, Response
from phoenix.config import EXPORT_DIR
from phoenix.core.model_schema_adapter import create_model_from_inferences
from phoenix.db import models
from phoenix.db.bulk_inserter import BulkInserter
from phoenix.db.engines import aio_postgresql_engine, aio_sqlite_engine
from phoenix.inferences.inferences import EMPTY_INFERENCES
from phoenix.pointcloud.umap_parameters import get_umap_parameters
from phoenix.server.app import _db, create_app
from phoenix.server.grpc_server import GrpcServer
from phoenix.server.types import DbSessionFactory
from phoenix.session.client import Client
from psycopg import Connection
from pytest_postgresql import factories
from sqlalchemy import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from starlette.types import ASGIApp


def pytest_addoption(parser: Parser) -> None:
    parser.addoption(
        "--run-postgres",
        action="store_true",
        default=False,
        help="Run tests that require Postgres",
    )


def pytest_collection_modifyitems(config: Config, items: List[Any]) -> None:
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


postgresql_connection = factories.postgresql("postgresql_proc")


@pytest.fixture()
async def postgresql_url(postgresql_connection: Connection) -> AsyncIterator[URL]:
    connection = postgresql_connection
    user = connection.info.user
    password = connection.info.password
    database = connection.info.dbname
    host = connection.info.host
    port = connection.info.port
    yield make_url(f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}")


@pytest.fixture
async def postgresql_engine(postgresql_url: URL) -> AsyncIterator[AsyncEngine]:
    engine = aio_postgresql_engine(postgresql_url, migrate=False)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture(params=["sqlite", "postgresql"])
def dialect(request: SubRequest) -> str:
    return request.param


@pytest.fixture
async def sqlite_engine() -> AsyncIterator[AsyncEngine]:
    engine = aio_sqlite_engine(make_url("sqlite+aiosqlite://"), migrate=False, shared_cache=False)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
def db(
    request: SubRequest,
    dialect: str,
) -> DbSessionFactory:
    if dialect == "sqlite":
        return _db_with_lock(request.getfixturevalue("sqlite_engine"))
    elif dialect == "postgresql":
        return _db_with_lock(request.getfixturevalue("postgresql_engine"))
    raise ValueError(f"Unknown db fixture: {dialect}")


def _db_with_lock(engine: AsyncEngine) -> DbSessionFactory:
    lock, db = asyncio.Lock(), _db(engine)

    @contextlib.asynccontextmanager
    async def _() -> AsyncIterator[AsyncSession]:
        async with lock, db() as session:
            yield session

    return _


@pytest.fixture
async def project(db: DbSessionFactory) -> None:
    project = models.Project(name="test_project")
    async with db() as session:
        session.add(project)


@pytest.fixture
async def app(
    dialect: str,
    db: Callable[[], AsyncContextManager[AsyncSession]],
) -> AsyncIterator[ASGIApp]:
    factory = DbSessionFactory(db=db, dialect=dialect)
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_bulk_inserter())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=factory,
            model=create_model_from_inferences(EMPTY_INFERENCES, None),
            export_path=EXPORT_DIR,
            umap_params=get_umap_parameters(None),
            serve_ui=False,
        )
        manager = await stack.enter_async_context(LifespanManager(app))
        yield manager.app


@pytest.fixture
async def loop() -> AbstractEventLoop:
    return get_running_loop()


@pytest.fixture
def httpx_clients(
    app: ASGIApp,
    loop: AbstractEventLoop,
) -> Tuple[httpx.Client, httpx.AsyncClient]:
    class Transport(httpx.BaseTransport, httpx.AsyncBaseTransport):
        def __init__(self, transport: httpx.ASGITransport) -> None:
            self.transport = transport

        def handle_request(self, request: Request) -> Response:
            fut = loop.create_task(self.handle_async_request(request))
            while not fut.done():
                sleep(0.01)
            return fut.result()

        async def handle_async_request(self, request: Request) -> Response:
            response = await self.transport.handle_async_request(request)
            return Response(
                status_code=response.status_code,
                headers=response.headers,
                content=b"".join([_ async for _ in response.stream]),
                request=request,
            )

    transport = Transport(httpx.ASGITransport(app))
    base_url = "http://test"
    return (
        httpx.Client(transport=transport, base_url=base_url),
        httpx.AsyncClient(transport=transport, base_url=base_url),
    )


@pytest.fixture
def httpx_client(
    httpx_clients: Tuple[httpx.Client, httpx.AsyncClient],
) -> httpx.AsyncClient:
    return httpx_clients[1]


@pytest.fixture
def px_client(
    httpx_clients: Tuple[httpx.Client, httpx.AsyncClient],
) -> Client:
    sync_client, _ = httpx_clients
    client = Client()
    client._client = sync_client
    client._base_url = str(sync_client.base_url)
    sync_client._base_url = URL("")
    return client


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


@contextlib.asynccontextmanager
async def patch_bulk_inserter() -> AsyncIterator[None]:
    cls = BulkInserter
    original = cls.__init__
    name = original.__name__
    changes = {"sleep": 0.001}
    setattr(cls, name, lambda *_, **__: original(*_, **{**__, **changes}))
    yield
    setattr(cls, name, original)
