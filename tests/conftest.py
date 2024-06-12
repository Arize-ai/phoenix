import asyncio
import contextlib
from typing import AsyncContextManager, AsyncGenerator, AsyncIterator, Callable

import httpx
import pytest
from httpx import Request, Response
from phoenix.config import EXPORT_DIR
from phoenix.core.model_schema_adapter import create_model_from_inferences
from phoenix.db import models
from phoenix.db.engines import aio_sqlite_engine
from phoenix.inferences.inferences import EMPTY_INFERENCES
from phoenix.pointcloud.umap_parameters import get_umap_parameters
from phoenix.server.app import SessionFactory, create_app
from psycopg import Connection
from pytest_postgresql import factories
from sqlalchemy import make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


def pytest_addoption(parser):
    parser.addoption(
        "--run-postgres",
        action="store_true",
        default=False,
        help="Run tests that require Postgres",
    )


def pytest_collection_modifyitems(config, items):
    skip_postgres = pytest.mark.skip(reason="Skipping Postgres tests")
    if not config.getoption("--run-postgres"):
        for item in items:
            if "dialect" in item.fixturenames:
                if "postgresql" in item.callspec.params.values():
                    item.add_marker(skip_postgres)


@pytest.fixture
def openai_api_key(monkeypatch: pytest.MonkeyPatch) -> str:
    api_key = "sk-0123456789"
    monkeypatch.setenv("OPENAI_API_KEY", api_key)
    return api_key


phoenix_postgresql = factories.postgresql("postgresql_proc")


def create_async_postgres_engine(psycopg_connection: Connection) -> AsyncEngine:
    connection = psycopg_connection.cursor().connection
    user = connection.info.user
    password = connection.info.password
    database = connection.info.dbname
    host = connection.info.host
    port = connection.info.port
    async_database_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}"
    return create_async_engine(async_database_url)


@pytest.fixture
async def postgres_engine(phoenix_postgresql: Connection) -> AsyncGenerator[AsyncEngine, None]:
    engine = create_async_postgres_engine(phoenix_postgresql)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture(params=["sqlite", "postgresql"])
def dialect(request):
    return request.param


@pytest.fixture
async def sqlite_engine() -> AsyncEngine:
    engine = aio_sqlite_engine(make_url("sqlite+aiosqlite://"), migrate=False, shared_cache=False)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    return engine


@pytest.fixture
def session(request, dialect) -> AsyncSession:
    if dialect == "sqlite":
        return request.getfixturevalue("sqlite_session")
    elif dialect == "postgresql":
        return request.getfixturevalue("postgres_session")
    raise ValueError(f"Unknown session fixture: {dialect}")


@pytest.fixture
def db(request, dialect) -> async_sessionmaker:
    if dialect == "sqlite":
        return request.getfixturevalue("sqlite_db")
    elif dialect == "postgresql":
        return request.getfixturevalue("postgres_db")
    raise ValueError(f"Unknown db fixture: {dialect}")


@pytest.fixture
async def sqlite_db(
    sqlite_engine: AsyncEngine,
) -> AsyncGenerator[Callable[[], AsyncContextManager[AsyncSession]], None]:
    Session = async_sessionmaker(sqlite_engine, expire_on_commit=False)

    async with Session.begin() as session:

        @contextlib.asynccontextmanager
        async def factory() -> AsyncIterator[AsyncSession]:
            yield session

        yield factory


@pytest.fixture
async def postgres_db(
    postgres_engine: AsyncEngine,
) -> AsyncGenerator[Callable[[], AsyncContextManager[AsyncSession]], None]:
    Session = async_sessionmaker(postgres_engine, expire_on_commit=False)
    async with Session.begin() as session:

        @contextlib.asynccontextmanager
        async def factory() -> AsyncIterator[AsyncSession]:
            yield session

        yield factory


@pytest.fixture
async def sqlite_session(
    sqlite_db: Callable[[], AsyncContextManager[AsyncSession]],
) -> AsyncGenerator[AsyncSession, None]:
    async with sqlite_db() as session:
        yield session


@pytest.fixture
async def postgres_session(
    postgres_db: Callable[[], AsyncContextManager[AsyncSession]],
) -> AsyncGenerator[AsyncSession, None]:
    async with postgres_db() as session:
        yield session


@pytest.fixture
async def project(session: AsyncSession) -> None:
    project = models.Project(name="test_project")
    session.add(project)


@pytest.fixture
async def test_client(dialect, db):
    factory = SessionFactory(session_factory=db, dialect=dialect)
    app = create_app(
        db=factory,
        model=create_model_from_inferences(EMPTY_INFERENCES, None),
        export_path=EXPORT_DIR,
        umap_params=get_umap_parameters(None),
        serve_ui=False,
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client


@pytest.fixture
def sync_test_client(dialect, db):
    factory = SessionFactory(session_factory=db, dialect=dialect)
    app = create_app(
        db=factory,
        model=create_model_from_inferences(EMPTY_INFERENCES, None),
        export_path=EXPORT_DIR,
        umap_params=get_umap_parameters(None),
        serve_ui=False,
    )

    class SyncTransport(httpx.BaseTransport):
        def __init__(self, app, asgi_transport):
            self.app = app
            self.asgi_transport = asgi_transport

        def handle_request(self, request: Request) -> Response:
            response = asyncio.run(self.asgi_transport.handle_async_request(request))

            async def read_stream():
                content = b""
                async for chunk in response.stream:
                    content += chunk
                return content

            content = asyncio.run(read_stream())
            return Response(
                status_code=response.status_code,
                headers=response.headers,
                content=content,
                request=request,
            )

    asgi_transport = httpx.ASGITransport(app=app)
    transport = SyncTransport(app, asgi_transport=asgi_transport)
    client = httpx.Client(transport=transport, base_url="http://test")
    return client
