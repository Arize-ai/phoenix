from typing import Optional

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, text


def test_up_and_down_migrations(
    _alembic_config: Config,
    _engine: Engine,
    _schema: Optional[str],
) -> None:
    table = "alembic_version"
    if _schema:
        table = f"{_schema}.{table}"
    stmt = text(f"SELECT version_num FROM {table}")
    with _engine.connect() as conn:
        with pytest.raises(BaseException, match=table):
            conn.execute(stmt)
    with _engine.connect() as conn:
        _alembic_config.attributes["connection"] = conn
        command.upgrade(_alembic_config, "head")
    with _engine.connect() as conn:
        version_num = conn.execute(stmt).first()
        assert version_num == ("cd164e83824f",)
    with _engine.connect() as conn:
        _alembic_config.attributes["connection"] = conn
        command.downgrade(_alembic_config, "base")
    with _engine.connect() as conn:
        assert conn.execute(stmt).first() is None
