import asyncio
import json
from datetime import datetime
from enum import Enum
from sqlite3 import Connection
from typing import Any

import aiosqlite
import numpy as np
import sqlean
from sqlalchemy import URL, event, make_url
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from phoenix.db.migrate import migrate_in_thread
from phoenix.db.models import init_models

# supported backends
_SQLITE = "sqlite"
_POSTGRESQL = "postgresql"

sqlean.extensions.enable("text")


def set_sqlite_pragma(connection: Connection, _: Any) -> None:
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = OFF;")
    cursor.execute("PRAGMA cache_size = -32000;")
    cursor.execute("PRAGMA busy_timeout = 10000;")
    cursor.close()


def get_printable_db_url(connection_str: str) -> str:
    return make_url(connection_str).render_as_string(hide_password=True)


def get_async_db_url(connection_str: str) -> URL:
    """
    Parses the database URL string and returns a URL object that is async
    """
    url = make_url(connection_str)
    if not url.database:
        raise ValueError("Failed to parse database from connection string")
    backend = url.get_backend_name()
    if backend == _SQLITE:
        if url.database.startswith(":memory:"):
            url = url.set(query={"cache": "shared"})
        return url.set(drivername="sqlite+aiosqlite")
    if backend == _POSTGRESQL:
        url = url.set(drivername="postgresql+asyncpg")
        # For some reason username and password cannot be parsed from the typical slot
        # So we need to parse them out manually
        if url.username and url.password:
            url = url.set(
                query={"user": url.username, "password": url.password},
                password=None,
                username=None,
            )
        return url
    raise ValueError(f"Unsupported backend: {backend}")


def create_engine(connection_str: str, echo: bool = False) -> AsyncEngine:
    """
    Factory to create a SQLAlchemy engine from a URL string.
    """
    url = make_url(connection_str)
    if not url.database:
        raise ValueError("Failed to parse database from connection string")
    backend = url.get_backend_name()
    if backend == _SQLITE:
        return aio_sqlite_engine(url=url, echo=echo)
    if backend == _POSTGRESQL:
        return aio_postgresql_engine(url=url, echo=echo)
    raise ValueError(f"Unsupported backend: {backend}")


def aio_sqlite_engine(
    url: URL,
    echo: bool = False,
) -> AsyncEngine:
    async_url = get_async_db_url(url.render_as_string())
    database = async_url.render_as_string().partition("///")[-1]  # includes query

    def async_creator() -> aiosqlite.Connection:
        conn = aiosqlite.Connection(
            lambda: sqlean.connect(f"file:{database}", uri=True),
            iter_chunk_size=64,
        )
        conn.daemon = True
        return conn

    engine = create_async_engine(
        url=async_url,
        echo=echo,
        json_serializer=_dumps,
        async_creator=async_creator,
    )
    event.listen(engine.sync_engine, "connect", set_sqlite_pragma)
    if database.startswith(":memory:"):
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            asyncio.run(init_models(engine))
        else:
            asyncio.create_task(init_models(engine))
    else:
        migrate_in_thread(engine.url)
    return engine


def aio_postgresql_engine(
    url: URL,
    echo: bool = False,
) -> AsyncEngine:
    # Swap out the engine
    async_url = get_async_db_url(url.render_as_string(hide_password=False))
    engine = create_async_engine(url=async_url, echo=echo, json_serializer=_dumps)
    # TODO(persistence): figure out the postgres pragma
    # event.listen(engine.sync_engine, "connect", set_pragma)
    migrate_in_thread(engine.url)
    return engine


def _dumps(obj: Any) -> str:
    return json.dumps(obj, cls=_Encoder)


class _Encoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, Enum):
            return obj.value
        elif isinstance(obj, np.ndarray):
            return list(obj)
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        return super().default(obj)
