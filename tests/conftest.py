from typing import AsyncGenerator

import pytest
import sqlean
from phoenix.db import models
from psycopg import Connection
from pytest_postgresql import factories
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker


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
                if "postgres" in item.callspec.params.values():
                    item.add_marker(skip_postgres)


@pytest.fixture
def openai_api_key(monkeypatch: pytest.MonkeyPatch) -> str:
    api_key = "sk-0123456789"
    monkeypatch.setenv("OPENAI_API_KEY", api_key)
    return api_key


phoenix_postgresql = factories.postgresql("postgresql_proc")


def create_async_postgres_engine(psycopg_connection: Connection) -> sessionmaker:
    connection = psycopg_connection.cursor().connection
    user = connection.info.user
    password = connection.info.password
    database = connection.info.dbname
    host = connection.info.host
    port = connection.info.port
    async_database_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}"
    return create_async_engine(async_database_url)


def create_async_sqlite_engine() -> sessionmaker:
    return create_async_engine("sqlite+aiosqlite:///:memory:", module=sqlean)


@pytest.fixture
async def postgres_engine(phoenix_postgresql: Connection) -> AsyncGenerator[sessionmaker, None]:
    engine = create_async_postgres_engine(phoenix_postgresql)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def sqlite_engine() -> AsyncGenerator[sessionmaker, None]:
    engine = create_async_sqlite_engine()
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture(params=["sqlite", "postgres"])
def session(request) -> AsyncSession:
    return request.getfixturevalue(request.param)


@pytest.fixture
async def sqlite(sqlite_engine: sessionmaker) -> AsyncGenerator[AsyncSession, None]:
    async_session = sessionmaker(sqlite_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session


@pytest.fixture
async def postgres(postgres_engine: sessionmaker) -> AsyncGenerator[AsyncSession, None]:
    async_session = sessionmaker(postgres_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session


@pytest.fixture
async def project(session: AsyncSession) -> None:
    project = models.Project(name="test_project")
    session.add(project)
