import codecs
import logging
import sys
from pathlib import Path
from queue import Empty, SimpleQueue
from threading import Thread
from typing import Optional

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine

from phoenix.exceptions import PhoenixMigrationError
from phoenix.settings import Settings

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())


def printif(condition: bool, text: str) -> None:
    if not condition:
        return
    if sys.platform.startswith("win"):
        text = codecs.encode(text, "ascii", errors="ignore").decode("ascii").strip()
    print(text)


def migrate(
    engine: Engine,
    error_queue: Optional["SimpleQueue[BaseException]"] = None,
) -> None:
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
        url = str(engine.url).replace("%", "%%")
        alembic_cfg.set_main_option("sqlalchemy.url", url)
        alembic_cfg.attributes["connection"] = engine.connect()
        command.upgrade(alembic_cfg, "head")
        engine.dispose()
        printif(log_migrations, "---------------------------")
        printif(log_migrations, "✅ Migrations complete.")
    except BaseException as e:
        if error_queue:
            error_queue.put(e)
            raise e


def migrate_in_thread(engine: Engine) -> None:
    """
    Runs migrations on the database in a separate thread.
    This is needed because depending on the context (notebook)
    the migration process can fail to execute in the main thread.
    """
    error_queue: SimpleQueue[BaseException] = SimpleQueue()
    t = Thread(target=migrate, args=(engine, error_queue))
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
