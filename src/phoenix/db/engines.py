import asyncio
import json
from datetime import datetime
from enum import Enum
from pathlib import Path
from sqlite3 import Connection
from typing import Any, Union

import numpy as np
from sqlalchemy import URL, event
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from phoenix.db.migrate import migrate
from phoenix.db.models import init_models


# Enum for the the different sql drivers
class SQLDriver(Enum):
    SQLITE = "sqlite"
    POSTGRES = "postgres"


def set_sqlite_pragma(connection: Connection, _: Any) -> None:
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = OFF;")
    cursor.execute("PRAGMA cache_size = -32000;")
    cursor.execute("PRAGMA busy_timeout = 10000;")
    cursor.close()


def get_db_url(driver: str = "sqlite+aiosqlite", database: Union[str, Path] = ":memory:") -> URL:
    return URL.create(driver, database=str(database))


def db_url_from_str(url_str: str) -> URL:
    return URL.create(url_str)


def create_engine(url_str: str, echo: bool = False) -> AsyncEngine:
    url = db_url_from_str(url_str)
    if "sqlite" in url.drivername:
        return aiosqlite_engine(database=url.database, echo=echo)
    if "postgres" in url.drivername:
        return create_async_engine(url=url, echo=echo)
    raise ValueError(f"Unsupported driver: {url.drivername}")


def aiosqlite_engine(
    database: Union[str, Path] = ":memory:",
    echo: bool = False,
) -> AsyncEngine:
    url = get_db_url(driver="sqlite+aiosqlite", database=database)
    engine = create_async_engine(url=url, echo=echo, json_serializer=_dumps)
    event.listen(engine.sync_engine, "connect", set_sqlite_pragma)
    if str(database) == ":memory:":
        asyncio.run(init_models(engine))
    else:
        migrate(url)
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
