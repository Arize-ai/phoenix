import os
from typing import Optional

from alembic import command
from alembic.config import Config
from phoenix.config import ENV_PHOENIX_SQL_DATABASE_SCHEMA
from sqlalchemy import Engine, Row, text


def _up(engine: Engine, alembic_config: Config, revision: str) -> None:
    with engine.connect() as conn:
        alembic_config.attributes["connection"] = conn
        command.upgrade(alembic_config, revision)
    engine.dispose()
    actual = _version_num(engine)
    assert actual == (revision,)


def _down(engine: Engine, alembic_config: Config, revision: str) -> None:
    with engine.connect() as conn:
        alembic_config.attributes["connection"] = conn
        command.downgrade(alembic_config, revision)
    engine.dispose()
    assert _version_num(engine) == (None if revision == "base" else (revision,))


def _version_num(engine: Engine) -> Optional[Row[tuple[str]]]:
    schema_prefix = ""
    if engine.url.get_backend_name().startswith("postgresql"):
        assert (schema := os.environ[ENV_PHOENIX_SQL_DATABASE_SCHEMA])
        schema_prefix = f"{schema}."
    table, column = "alembic_version", "version_num"
    stmt = text(f"SELECT {column} FROM {schema_prefix}{table}")
    with engine.connect() as conn:
        return conn.execute(stmt).first()
