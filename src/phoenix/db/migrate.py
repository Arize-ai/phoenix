import logging
from pathlib import Path
from threading import Thread

from alembic import command
from alembic.config import Config
from sqlalchemy import URL

from phoenix.settings import Settings

logger = logging.getLogger(__name__)


def printif(condition: bool, text: str) -> None:
    if condition:
        print(text)


def migrate(url: URL) -> None:
    """
    Runs migrations on the database.
    NB: Migrate only works on non-memory databases.

    Args:
        url: The database URL.
    """
    log_migrations = Settings.log_migrations
    printif(log_migrations, "🏃‍♀️‍➡️ Running migrations on the database.")
    printif(log_migrations, "---------------------------")
    config_path = str(Path(__file__).parent.resolve() / "alembic.ini")
    alembic_cfg = Config(config_path)

    # Explicitly set the migration directory
    scripts_location = str(Path(__file__).parent.resolve() / "migrations")
    alembic_cfg.set_main_option("script_location", scripts_location)
    alembic_cfg.set_main_option("sqlalchemy.url", str(url))
    command.upgrade(alembic_cfg, "head")
    printif(log_migrations, "---------------------------")
    printif(log_migrations, "✅ Migrations complete.")


def migrate_in_thread(url: URL) -> None:
    """
    Runs migrations on the database in a separate thread.
    This is needed because depending on the context (notebook)
    the migration process can fail to execute in the main thread.
    """
    t = Thread(target=migrate, args=(url,))
    t.start()
    t.join()
