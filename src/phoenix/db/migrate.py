import logging
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, List

from alembic import command
from alembic.config import Config
from sqlalchemy import URL


@contextmanager
def using_log_level(new_level: int, logger_names: List[str]) -> Iterator[Any]:
    original_levels = {}
    try:
        for name in logger_names:
            logger = logging.getLogger(name)
            # Save the original log level
            original_levels[name] = logger.level
            # Set the new log level
            logger.setLevel(new_level)
        yield
    finally:
        # Revert log levels to their original states
        for name, level in original_levels.items():
            logger = logging.getLogger(name)
            logger.setLevel(level)


logger = logging.getLogger(__name__)


def migrate(url: URL) -> None:
    """
    Runs migrations on the database.
    NB: Migrate only works on non-memory databases.

    Args:
        url: The database URL.
    """
    print("🏃‍♀️‍➡️ Running migrations on the database.")
    print("---------------------------")
    config_path = str(Path(__file__).parent.resolve() / "alembic.ini")
    alembic_cfg = Config(config_path)

    # Explicitly set the migration directory
    scripts_location = str(Path(__file__).parent.resolve() / "migrations")
    alembic_cfg.set_main_option("script_location", scripts_location)
    alembic_cfg.set_main_option("sqlalchemy.url", str(url))

    with using_log_level(logging.DEBUG, ["sqlalchemy", "alembic"]):
        command.upgrade(alembic_cfg, "head")
    print("---------------------------")
    print("✅ Migrations complete.")
