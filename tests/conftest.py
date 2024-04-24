
import pytest
from phoenix.db.models import Base
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker


def create_async_sqlite_engine():
    return create_async_engine("sqlite+aiosqlite:///:memory:")


@pytest.fixture()
async def postgres_engine(postgresql):
    connection = postgresql.cursor().connection
    user = connection.info.user
    password = connection.info.password
    database = connection.info.dbname
    host = connection.info.host
    port = connection.info.port
    async_database_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}"
    engine = create_async_engine(async_database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture()
async def sqlite_engine():
    engine = create_async_sqlite_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture(scope="function")
async def sqlite_session(sqlite_engine):
    async_session = sessionmaker(sqlite_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session


@pytest.fixture(scope="function")
async def postgresql_session(postgres_engine):
    async_session = sessionmaker(postgres_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session
