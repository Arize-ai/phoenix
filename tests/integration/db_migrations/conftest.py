import os
from contextlib import ExitStack
from pathlib import Path
from secrets import token_hex
from typing import Any, Iterator
from unittest import mock

import phoenix
import pytest
import sqlean  # type: ignore[import-untyped]
from alembic.config import Config
from phoenix.config import ENV_PHOENIX_SQL_DATABASE_SCHEMA
from phoenix.db.engines import set_postgresql_search_path
from pytest import TempPathFactory
from sqlalchemy import URL, Engine, NullPool, create_engine, event

from .._helpers import _random_schema


@pytest.fixture
def _alembic_config() -> Config:
    root = Path(phoenix.db.__path__[0])
    cfg = Config(root / "alembic.ini")
    cfg.set_main_option("script_location", str(root / "migrations"))
    return cfg


@pytest.fixture(autouse=True, scope="function")
def _env_postgresql_schema(
    _sql_database_url: URL,
) -> Iterator[None]:
    if not _sql_database_url.get_backend_name().startswith("postgresql"):
        yield
        return
    with ExitStack() as stack:
        schema = stack.enter_context(_random_schema(_sql_database_url))
        values = [(ENV_PHOENIX_SQL_DATABASE_SCHEMA, schema)]
        stack.enter_context(mock.patch.dict(os.environ, values))
        yield


@pytest.fixture
def _engine(
    _sql_database_url: URL,
    _env_postgresql_schema: Any,
    tmp_path_factory: TempPathFactory,
) -> Iterator[Engine]:
    backend = _sql_database_url.get_backend_name()
    if backend == "sqlite":
        tmp = tmp_path_factory.getbasetemp() / Path(__file__).parent.name
        tmp.mkdir(parents=True, exist_ok=True)
        file = tmp / f".{token_hex(16)}.db"
        engine = create_engine(
            url=_sql_database_url.set(database=str(file)),
            creator=lambda: sqlean.connect(f"file:///{file}", uri=True),
            poolclass=NullPool,
            echo=True,
        )
    elif backend == "postgresql":
        schema = os.environ[ENV_PHOENIX_SQL_DATABASE_SCHEMA]
        engine = create_engine(
            url=_sql_database_url.set(drivername="postgresql+psycopg"),
            poolclass=NullPool,
            echo=True,
        )
        event.listen(engine, "connect", set_postgresql_search_path(schema))
    else:
        pytest.fail(f"Unknown backend: {backend}")
    yield engine
    engine.dispose()
