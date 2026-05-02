import logging
from pathlib import Path
from queue import Empty, SimpleQueue
from threading import Thread
from time import perf_counter
from typing import Optional

from alembic import command
from alembic.config import Config
from sqlalchemy.ext.asyncio import AsyncEngine

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
    engine: AsyncEngine,
    error_queue: Optional["SimpleQueue[BaseException]"] = None,
    log_migrations: bool = True,
) -> None:
    """
    Runs migrations on the database.

    The caller must provide a disposable engine (e.g. with NullPool) — this
    function disposes it after use. Do not pass the server's main engine.
    """
    import asyncio

    try:
        printif(log_migrations, "🏃‍♀️‍➡️ Running migrations on the database.")
        printif(log_migrations, "---------------------------")
        config_path = str(Path(__file__).parent.resolve() / "alembic.ini")
        alembic_cfg = Config(config_path)

        scripts_location = str(Path(__file__).parent.resolve() / "migrations")
        alembic_cfg.set_main_option("script_location", scripts_location)
        url = str(engine.url).replace("%", "%%")
        alembic_cfg.set_main_option("sqlalchemy.url", url)
        start_time = perf_counter()

        async def run() -> None:
            async with engine.connect() as conn:
                await conn.run_sync(_run_alembic_upgrade, alembic_cfg)
            await engine.dispose()

        asyncio.run(run())
        elapsed_time = perf_counter() - start_time
        printif(log_migrations, "---------------------------")
        printif(log_migrations, f"✅ Migrations completed in {elapsed_time:.3f} seconds.")
    except BaseException as e:
        if error_queue:
            error_queue.put(e)
            return
        raise


def _run_alembic_upgrade(connection, alembic_cfg: Config) -> None:  # type: ignore[no-untyped-def]
    alembic_cfg.attributes["connection"] = connection
    command.upgrade(alembic_cfg, "head")


def migrate_in_thread(engine: AsyncEngine, log_migrations: bool = True) -> None:
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
