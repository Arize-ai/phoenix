from collections.abc import AsyncIterator
from pathlib import Path
from secrets import token_hex

import aiosqlite
import pytest
import sqlean
from alembic.config import Config
from pytest import TempPathFactory
from sqlalchemy import URL, NullPool, event
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

import phoenix
from phoenix.db.engines import get_async_db_url

from .._helpers import _SCHEMA_PREFIX, _random_schema


@pytest.fixture
def _alembic_config() -> Config:
    root = Path(phoenix.db.__path__[0])
    cfg = Config(root / "alembic.ini")
    cfg.set_main_option("script_location", str(root / "migrations"))
    return cfg


@pytest.fixture
async def _schema(
    _sql_database_url: URL,
) -> AsyncIterator[str]:
    if not _sql_database_url.get_backend_name().startswith("postgresql"):
        yield ""
    else:
        async with _random_schema(_sql_database_url) as schema:
            yield schema


@pytest.fixture
async def _engine(
    _sql_database_url: URL,
    _schema: str,
    tmp_path_factory: TempPathFactory,
) -> AsyncIterator[AsyncEngine]:
    backend = _sql_database_url.get_backend_name()
    if backend == "sqlite":
        assert not _schema, "SQLite does not support schemas"
        tmp = tmp_path_factory.getbasetemp() / Path(__file__).parent.name
        tmp.mkdir(parents=True, exist_ok=True)
        file = tmp / f".{token_hex(16)}.db"

        def async_creator() -> aiosqlite.Connection:
            conn = aiosqlite.Connection(
                lambda: sqlean.connect(f"file:{file}", uri=True),
                iter_chunk_size=64,
            )
            # aiosqlite>=0.22 moved the worker to Connection._thread; SQLAlchemy's
            # aiosqlite dialect daemonizes it only when it creates the connection
            # itself, not when an async_creator is used.
            conn._thread.daemon = True
            return conn

        engine = create_async_engine(
            url=_sql_database_url.set(drivername="sqlite+aiosqlite", database=str(file)),
            async_creator=async_creator,
            poolclass=NullPool,
            echo=True,
        )
        # Don't set foreign_keys pragma on the migration engine — PRAGMA
        # foreign_keys = ON causes batch_alter_table's DROP TABLE to cascade
        # and delete child rows. The runtime server engine sets this pragma;
        # the migration engine should not.
        yield engine
        await engine.dispose()
    elif backend == "postgresql":
        assert _schema.startswith(_SCHEMA_PREFIX), "PostgreSQL requires a schema"
        async_url = get_async_db_url(_sql_database_url.render_as_string(hide_password=False))
        engine = create_async_engine(url=async_url, poolclass=NullPool, echo=True)
        schema = _schema

        @event.listens_for(engine.sync_engine, "connect")
        def _set_search_path(dbapi_conn, _):  # type: ignore[no-untyped-def]
            cursor = dbapi_conn.cursor()
            cursor.execute(f"SET search_path TO {schema};")

        yield engine
        await engine.dispose()
    else:
        pytest.fail(f"Unknown backend: {backend}")
