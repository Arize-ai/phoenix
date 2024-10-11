import os
from pathlib import Path
from secrets import token_hex
from typing import Any, Iterator

import phoenix
import pytest
import sqlean  # type: ignore[import-untyped]
from alembic.config import Config
from phoenix.config import ENV_PHOENIX_SQL_DATABASE_SCHEMA, ENV_PHOENIX_SQL_DATABASE_URL
from phoenix.db.engines import set_postgresql_search_path
from pytest import TempPathFactory
from sqlalchemy import Engine, NullPool, create_engine, event, make_url


@pytest.fixture
def _alembic_config() -> Config:
    root = Path(phoenix.db.__path__[0])
    cfg = Config(root / "alembic.ini")
    cfg.set_main_option("script_location", str(root / "migrations"))
    return cfg


@pytest.fixture
def _engine(
    _env_phoenix_sql_database_url: Any,
    tmp_path_factory: TempPathFactory,
) -> Iterator[Engine]:
    url = make_url(os.environ[ENV_PHOENIX_SQL_DATABASE_URL])
    schema = os.environ.get(ENV_PHOENIX_SQL_DATABASE_SCHEMA)
    backend = url.get_backend_name()
    if backend.startswith("sqlite"):
        tmp = tmp_path_factory.getbasetemp() / Path(__file__).parent.name
        tmp.mkdir(parents=True, exist_ok=True)
        file = tmp / f".{token_hex(16)}.db"
        database = f"file:///{file}"
        engine = create_engine(
            url=url.set(drivername="sqlite", database=database),
            creator=lambda: sqlean.connect(database, uri=True),
            poolclass=NullPool,
            echo=True,
        )
    elif backend.startswith("postgresql"):
        assert schema
        engine = create_engine(
            url=url.set(drivername="postgresql+psycopg"),
            poolclass=NullPool,
            echo=True,
        )
        event.listen(engine, "connect", set_postgresql_search_path(schema))
    else:
        pytest.fail(f"Unknown database backend: {backend}")
    yield engine
    engine.dispose()
