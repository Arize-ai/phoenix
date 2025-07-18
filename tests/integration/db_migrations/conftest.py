from collections.abc import Iterator
from pathlib import Path
from secrets import token_hex

import phoenix
import pytest
import sqlean  # type: ignore[import-untyped]
from alembic.config import Config
from phoenix.db.engines import set_postgresql_search_path
from pytest import TempPathFactory
from sqlalchemy import URL, Engine, NullPool, create_engine, event

from .._helpers import _SCHEMA_PREFIX, _random_schema


@pytest.fixture
def _alembic_config() -> Config:
    root = Path(phoenix.db.__path__[0])
    cfg = Config(root / "alembic.ini")
    cfg.set_main_option("script_location", str(root / "migrations"))
    return cfg


@pytest.fixture
def _schema(
    _sql_database_url: URL,
) -> Iterator[str]:
    if not _sql_database_url.get_backend_name().startswith("postgresql"):
        yield ""
    else:
        with _random_schema(_sql_database_url) as schema:
            yield schema


@pytest.fixture
def _engine(
    _sql_database_url: URL,
    _schema: str,
    tmp_path_factory: TempPathFactory,
) -> Iterator[Engine]:
    backend = _sql_database_url.get_backend_name()
    if backend == "sqlite":
        assert not _schema, "SQLite does not support schemas"
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
        assert _schema.startswith(_SCHEMA_PREFIX), "PostgreSQL requires a schema"
        engine = create_engine(
            url=_sql_database_url.set(drivername="postgresql+psycopg"),
            poolclass=NullPool,
            echo=True,
        )
        event.listen(engine, "connect", set_postgresql_search_path(_schema))
    else:
        pytest.fail(f"Unknown backend: {backend}")
    yield engine
    engine.dispose()
