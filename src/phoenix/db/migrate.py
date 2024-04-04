import logging
import os
from pathlib import Path

from alembic import command
from alembic.config import Config

logger = logging.getLogger(__name__)


def migrate() -> None:
    """
    Runs migrations on the database.
    """
    config_path = os.path.normpath(str(Path(__file__).parent.resolve()) + os.sep + "alembic.ini")
    alembic_cfg = Config(config_path)

    # Explicitly set the migration directory
    scripts_location = os.path.normpath(
        str(Path(__file__).parent.resolve()) + os.sep + "migrations"
    )
    alembic_cfg.set_main_option("script_location", scripts_location)

    command.upgrade(alembic_cfg, "head")
