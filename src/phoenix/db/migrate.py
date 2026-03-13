import logging
from pathlib import Path
from queue import Empty, SimpleQueue
from threading import Thread
from time import perf_counter
from typing import Optional

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine

from phoenix.exceptions import PhoenixMigrationError
from phoenix.utilities import no_emojis_on_windows

logger = logging.getLogger(__name__)


_MIGRATION_FAILURE_MESSAGE = no_emojis_on_windows(
    "\n\n⚠️⚠️ Phoenix failed to migrate the database to the latest version. ⚠️⚠️\n\n"
    "The database may be in a dirty state. To resolve this, the Alembic CLI can be used\n"
    "from the `src/phoenix/db` directory inside the Phoenix project root. From here,\n"
    "revert any partial migrations and run `alembic stamp` to reset the migration state,\n"
    "then try starting Phoenix again.\n\n"
    "If issues persist, please reach out for support in the Arize community Slack:\n"
    "https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g\n\n"
    "You can also refer to the Alembic documentation for more information:\n"
    "https://alembic.sqlalchemy.org/en/latest/tutorial.html\n\n"
)


def printif(condition: bool, text: str) -> None:
    if not condition:
        return
    print(no_emojis_on_windows(text), flush=True)


def migrate(
    engine: Engine,
    error_queue: Optional["SimpleQueue[BaseException]"] = None,
    log_migrations: bool = True,
) -> None:
    """
    Runs migrations on the database.
    NB: Migrate only works on non-memory databases.

    Args:
        url: The database URL.
    """
    try:
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
            return
        raise


def migrate_in_thread(engine: Engine, log_migrations: bool = True) -> None:
    """
    Runs migrations on the database in a separate thread.
    This is needed because depending on the context (notebook)
    the migration process can fail to execute in the main thread.
    """
    error_queue: SimpleQueue[BaseException] = SimpleQueue()
    t = Thread(target=migrate, args=(engine, error_queue, log_migrations))
    t.start()
    t.join()

    try:
        result = error_queue.get_nowait()
    except Empty:
        return

    if result is not None:
        raise PhoenixMigrationError(_MIGRATION_FAILURE_MESSAGE) from result
