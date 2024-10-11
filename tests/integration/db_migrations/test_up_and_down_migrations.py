import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, text


def test_up_and_down_migrations(
    alembic_config: Config,
    engine: Engine,
) -> None:
    stmt = text("SELECT version_num FROM alembic_version")
    with engine.connect() as conn:
        with pytest.raises(BaseException, match="alembic_version"):
            conn.execute(stmt)
    with engine.connect() as conn:
        alembic_config.attributes["connection"] = conn
        command.upgrade(alembic_config, "head")
    with engine.connect() as conn:
        version_num = conn.execute(stmt).first()
        assert version_num == ("cd164e83824f",)
    with engine.connect() as conn:
        alembic_config.attributes["connection"] = conn
        command.downgrade(alembic_config, "base")
    with engine.connect() as conn:
        assert conn.execute(stmt).first() is None
