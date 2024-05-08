import contextlib
from typing import AsyncContextManager, AsyncGenerator, AsyncIterator, Callable

import pytest
from phoenix.db import models
from phoenix.db.engines import aio_sqlite_engine
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
            if "session" in item.fixturenames:
                if "postgres_session" in item.callspec.params.values():
                    item.add_marker(skip_postgres)
            elif "db" in item.fixturenames:
                if "postgres_db" in item.callspec.params.values():
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


@pytest.fixture
async def sqlite_engine() -> AsyncEngine:
    engine = aio_sqlite_engine(make_url("sqlite+aiosqlite://"), migrate=False, shared_cache=False)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    return engine


@pytest.fixture(params=["sqlite_session", "postgres_session"])
def session(request) -> AsyncSession:
    return request.getfixturevalue(request.param)


@pytest.fixture(params=["sqlite_db", "postgres_db"])
def db(request) -> async_sessionmaker:
    return request.getfixturevalue(request.param)


@pytest.fixture
async def sqlite_db(sqlite_engine: AsyncEngine) -> Callable[[], AsyncContextManager[AsyncSession]]:
    Session = async_sessionmaker(sqlite_engine, expire_on_commit=False)

    @contextlib.asynccontextmanager
    async def factory() -> AsyncIterator[AsyncSession]:
        async with Session.begin() as session:
            yield session

    return factory


@pytest.fixture
async def postgres_db(
    postgres_engine: AsyncEngine,
) -> Callable[[], AsyncContextManager[AsyncSession]]:
    Session = async_sessionmaker(postgres_engine, expire_on_commit=False)

    @contextlib.asynccontextmanager
    async def factory() -> AsyncIterator[AsyncSession]:
        async with Session.begin() as session:
            yield session

    return factory


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
