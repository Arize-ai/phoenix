import os

import pytest
from alembic import command
from alembic.config import Config
from phoenix.config import ENV_PHOENIX_SQL_DATABASE_SCHEMA
from sqlalchemy import Engine, text


def test_up_and_down_migrations(
    _alembic_config: Config,
    _engine: Engine,
) -> None:
    table = "alembic_version"
    if schema := os.environ.get(ENV_PHOENIX_SQL_DATABASE_SCHEMA):
        table = f"{schema}.{table}"
    stmt = text(f"SELECT version_num FROM {table}")
    with _engine.connect() as conn:
        with pytest.raises(BaseException, match=table):
            conn.execute(stmt)
    _engine.dispose()
    with _engine.connect() as conn:
        _alembic_config.attributes["connection"] = conn
        command.upgrade(_alembic_config, "head")
    _engine.dispose()
    with _engine.connect() as conn:
        version_num = conn.execute(stmt).first()
        assert version_num == ("cd164e83824f",)
    _engine.dispose()
    with _engine.connect() as conn:
        _alembic_config.attributes["connection"] = conn
        command.downgrade(_alembic_config, "base")
    _engine.dispose()
    with _engine.connect() as conn:
        assert conn.execute(stmt).first() is None
    _engine.dispose()
