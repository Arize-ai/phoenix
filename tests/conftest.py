import pytest
import sqlean
from phoenix.db import models
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def openai_api_key(monkeypatch: pytest.MonkeyPatch) -> str:
    api_key = "sk-0123456789"
    monkeypatch.setenv("OPENAI_API_KEY", api_key)
    return api_key


def create_async_postgres_engine(psycopg_connection) -> sessionmaker:
    connection = psycopg_connection.cursor().connection
    user = connection.info.user
    password = connection.info.password
    database = connection.info.dbname
    host = connection.info.host
    port = connection.info.port
    async_database_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}"
    return create_async_engine(async_database_url, echo=True)


def create_async_sqlite_engine() -> sessionmaker:
    return create_async_engine("sqlite+aiosqlite:///:memory:", module=sqlean, echo=True)


@pytest.fixture()
async def postgres_engine(postgresql):
    engine = create_async_postgres_engine(postgresql)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture()
async def sqlite_engine():
    engine = create_async_sqlite_engine()
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
def session(request) -> AsyncSession:
    return request.getfixturevalue(request.param)


@pytest.fixture(scope="function")
async def sqlite(sqlite_engine):
    async_session = sessionmaker(sqlite_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session


@pytest.fixture(scope="function")
async def postgres(postgres_engine):
    async_session = sessionmaker(postgres_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session


@pytest.fixture
async def project(session):
    project = models.Project(name="test_project")
    session.add(project)
