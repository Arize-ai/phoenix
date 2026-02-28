import codecs
import logging
import sys
from pathlib import Path
from queue import Empty, SimpleQueue
from threading import Thread
from time import perf_counter
from typing import Optional

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine

from phoenix.exceptions import PhoenixMigrationError
from phoenix.settings import Settings

logger = logging.getLogger(__name__)

# Fixed advisory lock ID used to serialize Alembic migrations across replicas.
_MIGRATION_LOCK_KEY = 3210841049


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
        start_time = perf_counter()
        with engine.connect() as conn:
            alembic_cfg.attributes["connection"] = conn
            command.upgrade(alembic_cfg, "head")
        elapsed_time = perf_counter() - start_time
        engine.dispose()
        printif(log_migrations, "---------------------------")
        printif(log_migrations, f"✅ Migrations completed in {elapsed_time:.3f} seconds.")
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


def _migrate_with_pg_lock(
    engine: Engine,
    error_queue: Optional["SimpleQueue[BaseException]"] = None,
) -> None:
    """
    Runs Alembic migrations while holding a PostgreSQL advisory lock.

    This serializes migration execution across horizontally scaled replicas:
    the first replica acquires the lock and runs migrations, while others block
    until the lock is released, then discover migrations are already at head.
    """
    from sqlalchemy import text

    try:
        log_migrations = Settings.log_migrations
        printif(log_migrations, "🏃‍♀️‍➡️ Running migrations on the database.")
        printif(log_migrations, "---------------------------")
        config_path = str(Path(__file__).parent.resolve() / "alembic.ini")
        alembic_cfg = Config(config_path)

        scripts_location = str(Path(__file__).parent.resolve() / "migrations")
        alembic_cfg.set_main_option("script_location", scripts_location)
        url = str(engine.url).replace("%", "%%")
        alembic_cfg.set_main_option("sqlalchemy.url", url)

        start_time = perf_counter()
        with engine.connect() as conn:
            # Set a safety timeout so we don't block forever if something goes wrong.
            conn.execute(text("SET lock_timeout = '300s'"))
            logger.info("Acquiring migration advisory lock (key=%d)...", _MIGRATION_LOCK_KEY)
            conn.execute(text(f"SELECT pg_advisory_lock({_MIGRATION_LOCK_KEY})"))
            logger.info("Migration advisory lock acquired.")
            # Commit the implicit transaction started by the above statements so
            # the connection is in a clean state for Alembic's run_migrations(),
            # which calls connection.begin() and expects no active transaction.
            conn.commit()
            try:
                alembic_cfg.attributes["connection"] = conn
                command.upgrade(alembic_cfg, "head")
            finally:
                conn.execute(text(f"SELECT pg_advisory_unlock({_MIGRATION_LOCK_KEY})"))
                logger.info("Migration advisory lock released.")
        elapsed_time = perf_counter() - start_time
        engine.dispose()
        printif(log_migrations, "---------------------------")
        printif(log_migrations, f"✅ Migrations completed in {elapsed_time:.3f} seconds.")
    except BaseException as e:
        if error_queue:
            error_queue.put(e)
            raise e


def migrate_in_thread_with_lock(engine: Engine) -> None:
    """
    Runs migrations on the database in a separate thread, using a PostgreSQL
    advisory lock to coordinate across horizontally scaled replicas.
    """
    error_queue: SimpleQueue[BaseException] = SimpleQueue()
    t = Thread(target=_migrate_with_pg_lock, args=(engine, error_queue))
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
