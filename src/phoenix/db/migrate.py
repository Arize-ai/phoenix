import logging
from pathlib import Path
from queue import Empty, Queue
from threading import Thread
from typing import Optional

from alembic import command
from alembic.config import Config
from sqlalchemy import URL

from phoenix.exceptions import PhoenixMigrationError
from phoenix.settings import Settings

logger = logging.getLogger(__name__)


def printif(condition: bool, text: str) -> None:
    if condition:
        print(text)


def migrate(url: URL, error_queue: Optional["Queue[Exception]"] = None) -> None:
    """
    Runs migrations on the database.
    NB: Migrate only works on non-memory databases.

    Args:
        url: The database URL.
    """
    try:
        log_migrations = Settings.log_migrations
        printif(log_migrations, "🏃‍♀️‍➡️ Running migrations on the database.")
        printif(log_migrations, "---------------------------")
        config_path = str(Path(__file__).parent.resolve() / "alembic.ini")
        alembic_cfg = Config(config_path)

        # Explicitly set the migration directory
        scripts_location = str(Path(__file__).parent.resolve() / "migrations")
        alembic_cfg.set_main_option("script_location", scripts_location)
        alembic_cfg.set_main_option("sqlalchemy.url", str(url).replace("%", "%%"))
        command.upgrade(alembic_cfg, "head")
        printif(log_migrations, "---------------------------")
        printif(log_migrations, "✅ Migrations complete.")
    except Exception as e:
        if error_queue:
            error_queue.put(e)
            raise e


def migrate_in_thread(url: URL) -> None:
    """
    Runs migrations on the database in a separate thread.
    This is needed because depending on the context (notebook)
    the migration process can fail to execute in the main thread.
    """
    error_queue: Queue[Exception] = Queue()
    t = Thread(target=migrate, args=(url, error_queue))
    t.start()
    t.join()

    try:
        result = error_queue.get_nowait()
    except Empty:
        return

    if result is not None:
        error_message = (
            "\n\nUnable to migrate configured Phoenix DB. Original error:\n"
            f"{type(result).__name__}: {str(result)}"
        )
        raise PhoenixMigrationError(error_message) from result
