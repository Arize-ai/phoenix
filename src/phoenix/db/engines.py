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


def set_sqlite_pragma(connection: Connection, _: Any) -> None:
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = OFF;")
    cursor.execute("PRAGMA cache_size = -32000;")
    cursor.execute("PRAGMA busy_timeout = 10000;")
    cursor.close()


def aiosqlite_engine(
    database: Union[str, Path] = ":memory:",
    echo: bool = False,
) -> AsyncEngine:
    driver_name = "sqlite+aiosqlite"
    url = URL.create(driver_name, database=str(database))
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
