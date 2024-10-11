from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, text


def test_up_and_down_migrations(
    alembic_config: Config,
    engine: Engine,
) -> None:
    with engine.connect() as conn:
        alembic_config.attributes["connection"] = conn
        command.upgrade(alembic_config, "head")
    stmt = text("SELECT version_num FROM alembic_version")
    with engine.connect() as conn:
        version_num = conn.execute(stmt).fetchone()
        assert version_num == ("cd164e83824f",)
    with engine.connect() as conn:
        alembic_config.attributes["connection"] = conn
        command.downgrade(alembic_config, "base")
    with engine.connect() as conn:
        version_num = conn.execute(stmt).fetchone()
        assert version_num is None
