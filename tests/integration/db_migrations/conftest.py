from contextlib import ExitStack
from pathlib import Path
from secrets import token_hex
from typing import Iterator

import phoenix
import pytest
import sqlean  # type: ignore[import-untyped]
from alembic.config import Config
from phoenix.db.engines import set_postgresql_search_path
from pytest import TempPathFactory
from sqlalchemy import URL, Engine, create_engine, event

from integration._helpers import _random_schema


@pytest.fixture(scope="session")
def alembic_config() -> Config:
    root = Path(phoenix.db.__path__[0])
    cfg = Config(root / "alembic.ini")
    cfg.set_main_option("script_location", str(root / "migrations"))
    return cfg


@pytest.fixture
def engine(
    _sql_database_url: URL,
    tmp_path_factory: TempPathFactory,
) -> Iterator[Engine]:
    backend = _sql_database_url.get_backend_name()
    with ExitStack() as stack:
        if backend.startswith("sqlite"):
            tmp = tmp_path_factory.getbasetemp() / Path(__file__).parent.name
            tmp.mkdir(parents=True, exist_ok=True)
            file = tmp / f".{token_hex(16)}.db"
            engine = create_engine(
                url=_sql_database_url.set(drivername="sqlite"),
                creator=lambda: sqlean.connect(f"file:///{file}", uri=True),
                echo=True,
            )
        elif backend.startswith("postgresql"):
            engine = create_engine(
                url=_sql_database_url.set(drivername="postgresql+psycopg"),
                echo=True,
            )
            schema = stack.enter_context(_random_schema(_sql_database_url))
            event.listen(engine, "connect", set_postgresql_search_path(schema))
        else:
            pytest.fail(f"Unknown database backend: {backend}")
        yield engine
        engine.dispose()
