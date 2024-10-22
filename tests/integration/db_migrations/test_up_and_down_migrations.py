import os
from typing import Optional, Tuple

import pytest
from alembic import command
from alembic.config import Config
from phoenix.config import ENV_PHOENIX_SQL_DATABASE_SCHEMA
from sqlalchemy import Engine, Row, text


def test_up_and_down_migrations(
    _engine: Engine,
    _alembic_config: Config,
) -> None:
    with pytest.raises(BaseException, match="alembic_version"):
        _version_num(_engine)

    for _ in range(2):
        _up(_engine, _alembic_config, "cf03bd6bae1d")
        _down(_engine, _alembic_config, "base")
    _up(_engine, _alembic_config, "cf03bd6bae1d")

    for _ in range(2):
        _up(_engine, _alembic_config, "10460e46d750")
        _down(_engine, _alembic_config, "cf03bd6bae1d")
    _up(_engine, _alembic_config, "10460e46d750")

    for _ in range(2):
        _up(_engine, _alembic_config, "3be8647b87d8")
        _down(_engine, _alembic_config, "10460e46d750")
    _up(_engine, _alembic_config, "3be8647b87d8")

    for _ in range(2):
        _up(_engine, _alembic_config, "cd164e83824f")
        _down(_engine, _alembic_config, "3be8647b87d8")
    _up(_engine, _alembic_config, "cd164e83824f")


def _up(_engine: Engine, _alembic_config: Config, revision: str) -> None:
    with _engine.connect() as conn:
        _alembic_config.attributes["connection"] = conn
        command.upgrade(_alembic_config, revision)
    _engine.dispose()
    assert _version_num(_engine) == (revision,)


def _down(_engine: Engine, _alembic_config: Config, revision: str) -> None:
    with _engine.connect() as conn:
        _alembic_config.attributes["connection"] = conn
        command.downgrade(_alembic_config, revision)
    _engine.dispose()
    assert _version_num(_engine) == (None if revision == "base" else (revision,))


def _version_num(_engine: Engine) -> Optional[Row[Tuple[str]]]:
    schema_prefix = ""
    if _engine.url.get_backend_name().startswith("postgresql"):
        assert (schema := os.environ[ENV_PHOENIX_SQL_DATABASE_SCHEMA])
        schema_prefix = f"{schema}."
    table, column = "alembic_version", "version_num"
    stmt = text(f"SELECT {column} FROM {schema_prefix}{table}")
    with _engine.connect() as conn:
        return conn.execute(stmt).first()
