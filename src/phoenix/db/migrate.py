import logging
import os
from pathlib import Path

from alembic import command
from alembic.config import Config

logger = logging.getLogger(__name__)


def migrate(url: str) -> None:
    """
    Runs migrations on the database.
    NB: Migrate only works on non-memory databases.

    Args:
        url: The database URL.
    """
    logger.warning("Running migrations on the database")
    config_path = str(Path(__file__).parent.resolve() / "alembic.ini")
    alembic_cfg = Config(config_path)

    # Explicitly set the migration directory
    scripts_location = os.path.normpath(
        str(Path(__file__).parent.resolve()) + os.sep + "migrations"
    )
    alembic_cfg.set_main_option("script_location", scripts_location)
    alembic_cfg.set_main_option("sqlalchemy.url", url)

    command.upgrade(alembic_cfg, "head")
