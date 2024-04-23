import asyncio

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker


def create_sqlite_engine():
    return create_engine("sqlite:///:memory:")


@pytest.fixture()
async def postgres_engine(postgresql):
    connection = postgresql.cursor().connection
    user = connection.info.user
    password = connection.info.password
    database = connection.info.dbname
    host = connection.info.host
    port = connection.info.port
    async_database_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}"
    sync_database_url = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"
    sync_engine = create_engine(sync_database_url)
    apply_migrations(sync_engine.connect())
    sync_engine.dispose()
    async_engine = create_async_engine(async_database_url, echo=True)
    yield async_engine
    await async_engine.dispose()


@pytest.fixture()
def sqlite_engine():
    engine = create_engine("sqlite:///:memory:")
    apply_migrations(engine.connect())
    yield engine
    engine.dispose()


def apply_migrations(connection):
    """Apply database migrations using Alembic."""
    alembic_cfg = Config("src/phoenix/db/alembic.ini")
    alembic_cfg.attributes["connection"] = connection
    alembic_cfg.set_main_option("script_location", "src/phoenix/db/migrations")
    command.upgrade(alembic_cfg, "head")
    alembic_cfg.attributes["connection"].close()


async def async_apply_migrations(engine: AsyncEngine):
    """Apply database migrations in an async context."""
    # Because Alembic does not support async, we use run_sync to execute in a thread pool
    alembic_cfg = Config("src/phoenix/db/alembic.ini")
    alembic_cfg.set_main_option("script_location", "src/phoenix/db/migrations")

    # Get a synchronous connection from the async engine
    connection = await engine.raw_connection()
    alembic_cfg.attributes["connection"] = connection
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, command.upgrade, alembic_cfg, "head")
    await connection.close()


@pytest.fixture(scope="function")
def sqlite_session(sqlite_engine):
    Session = sessionmaker(bind=sqlite_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture(scope="function")
async def postgresql_session(postgres_engine):
    async_session = sessionmaker(postgres_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session
