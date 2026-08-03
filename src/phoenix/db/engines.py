from __future__ import annotations

import asyncio
import logging
from enum import Enum
from sqlite3 import Connection
from threading import Thread
from typing import Any, Callable, Literal, Optional

import aiosqlite
import numpy as np
import orjson
import sqlean
from sqlalchemy import URL, NullPool, event, make_url
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import AsyncAdaptedQueuePool
from typing_extensions import assert_never

from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.migrate import migrate_in_thread
from phoenix.db.models import init_models
from phoenix.db.pg_config import get_pg_config

SQLEAN_EXTENSIONS = ("text", "stats")

sqlean.extensions.enable(*SQLEAN_EXTENSIONS)

logger = logging.getLogger(__name__)

# Recycle pooled connections so server-side changes (revoked roles,
# rotated certs, rebalanced managed-Postgres LB backends) eventually
# propagate into the pool. Liveness is handled separately by
# pool_pre_ping; this knob is purely for bounded staleness, not
# correctness — PostgreSQL authenticates only at session startup and
# does not re-validate the credential for the life of the session.
# The specific value is arbitrary within the 30-minute-to-few-hours
# range where connection churn is cheap and staleness stays bounded.
_POOL_RECYCLE_SECONDS = 3300

# Reader connections kept open, and so also aiosqlite worker threads. WAL
# imposes no reader limit; this bounds threads. Untuned -- 8 saturated the
# benchmark below, but Phoenix's real concurrent-read profile is unmeasured.
_READ_POOL_SIZE = 8

# Extra connections opened past the pool when every reader is busy, closed again
# on return. They absorb a burst without holding threads for the process
# lifetime; past them callers wait (see pool_timeout below) rather than fail.
_READ_MAX_OVERFLOW = 8


# Settings scoped to one connection. Safe anywhere: none touches the file.
_CONNECTION_PRAGMAS = (
    "PRAGMA foreign_keys = ON;",
    "PRAGMA cache_size = -32000;",
    "PRAGMA busy_timeout = 10000;",
)

# Properties of the database file. `journal_mode` writes to its header, so a
# read-only connection cannot set these and inherits whatever the writer left --
# which makes the writer opening first load-bearing rather than incidental.
_DATABASE_PRAGMAS = (
    "PRAGMA journal_mode = WAL;",
    "PRAGMA synchronous = OFF;",
)


def _apply_pragmas(connection: Connection, statements: tuple[str, ...]) -> None:
    cursor = connection.cursor()
    try:
        for statement in statements:
            cursor.execute(statement)
    finally:
        cursor.close()


def set_sqlite_pragma(connection: Connection, _: Any) -> None:
    _apply_pragmas(connection, _CONNECTION_PRAGMAS + _DATABASE_PRAGMAS)


def get_printable_db_url(connection_str: str) -> str:
    return make_url(connection_str).render_as_string(hide_password=True)


def get_async_db_url(connection_str: str) -> URL:
    """
    Parses the database URL string and returns a URL object that is async
    """
    url = make_url(connection_str)
    if not url.database:
        raise ValueError("Failed to parse database from connection string")
    backend = SupportedSQLDialect(url.get_backend_name())
    if backend is SupportedSQLDialect.SQLITE:
        return url.set(drivername="sqlite+aiosqlite")
    elif backend is SupportedSQLDialect.POSTGRESQL:
        url = url.set(drivername="postgresql+asyncpg")
        # For some reason username and password cannot be parsed from the typical slot
        # So we need to parse them out manually
        if url.username and url.password:
            url = url.set(
                query={**url.query, "user": url.username, "password": url.password},
                password=None,
                username=None,
            )
        return url
    else:
        assert_never(backend)


SQLiteAccessMode = Literal["ro", "rw", "rwc", "memory"]


def sqlite_connection_factory(
    database: str,
    *,
    mode: SQLiteAccessMode = "rwc",
    uri: bool = True,
    iter_chunk_size: int = 64,
) -> Callable[[], aiosqlite.Connection]:
    """Build the connector SQLAlchemy calls to open one SQLite connection.

    sqlean rather than the standard library: Phoenix's extensions are loaded
    there, so a stdlib connection would offer a different set of functions.

    `mode` is fixed when the file is opened and cannot be imposed afterwards, so
    it is the only place read-only-ness can be established -- `ro` refuses
    writes beneath every layer of application code, which no amount of careful
    calling can match.

    It defaults to `rwc` because connections open lazily: an engine built before
    migrations run may still connect first, and `rw` against a database that
    does not exist yet fails outright. Use `rw` only where the file is known to
    be there.
    """

    def connect() -> aiosqlite.Connection:
        # `mode` is a URI query parameter, so it only means anything when the
        # target is parsed as a URI. Appending it to a plain path would make the
        # filename literally contain "?mode=rw" rather than open read-write.
        if uri:
            separator = "&" if "?" in database else "?"
            target = f"file:{database}{separator}mode={mode}"
        else:
            target = database
        conn = aiosqlite.Connection(
            lambda: sqlean.connect(target, uri=uri),
            iter_chunk_size=iter_chunk_size,
        )
        # aiosqlite>=0.22 moved the worker to Connection._thread; SQLAlchemy's
        # aiosqlite dialect daemonizes it only when it creates the connection
        # itself, not when an async_creator is used.
        conn._thread.daemon = True
        return conn

    return connect


def set_sqlite_read_pragma(connection: Connection, _: Any) -> None:
    """The connection-scoped subset, for connections that cannot write.

    A `mode=ro` connection fails on `PRAGMA journal_mode = WAL`, so a read
    engine opened against a database whose WAL was never initialised cannot
    initialise it -- it can only inherit.
    """
    _apply_pragmas(connection, _CONNECTION_PRAGMAS)


def aio_sqlite_read_engine(url: URL) -> Optional[AsyncEngine]:
    """A read-only engine giving each concurrent reader its own connection.

    The primary engine shares one connection across every session, so reads run
    serialised behind the lock that keeps their transactions from interleaving
    (see `DbSessionFactory.read`). Here each session owns its connection, so
    there is nothing to serialise and no lock to take.

    `mode=ro` is the second reason to route reads here rather than widen the
    primary pool: writes are refused by the engine, not by convention.

    None for in-memory databases -- a second connection to `:memory:` is a
    different, empty database, and one developer has no concurrency to win.
    """
    if (url.database or ":memory:").startswith(":memory:"):
        return None
    database = url.render_as_string().partition("///")[-1]

    # Persistent connections, not one per checkout: each open spawns an aiosqlite
    # worker thread, which dominates a short read. Measured at 8 concurrent,
    # 200 reads ran at 490/s per-checkout against 3,879/s pooled.
    #
    # pool_timeout=None so a caller past the pool waits rather than fails.
    # Reads previously queued on an asyncio.Lock, which has no timeout, so
    # rejecting them here would narrow the contract that already exists --
    # a burst would start returning errors where it used to return answers
    # slowly. Waiting keeps that policy; the cost is that a connection held
    # indefinitely stalls its waiters, which was equally true of the lock.
    #
    # pre_ping is off because the target is a local file, with no network for
    # a connection to go stale across.
    engine = create_async_engine(
        url=url,
        json_serializer=_dumps,
        async_creator=sqlite_connection_factory(database, mode="ro"),
        pool_size=_READ_POOL_SIZE,
        max_overflow=_READ_MAX_OVERFLOW,
        pool_timeout=None,
        pool_pre_ping=False,
    )
    event.listen(engine.sync_engine, "connect", set_sqlite_read_pragma)
    return engine


def create_engine(
    connection_str: str,
    migrate: bool = True,
    log_to_stdout: bool = False,
    log_migrations: bool = True,
) -> AsyncEngine:
    """
    Factory to create a SQLAlchemy engine from a URL string.
    """
    url = make_url(connection_str)
    if not url.database:
        raise ValueError("Failed to parse database from connection string")
    backend = SupportedSQLDialect(url.get_backend_name())
    url = get_async_db_url(url.render_as_string(hide_password=False))
    if backend is SupportedSQLDialect.SQLITE:
        return aio_sqlite_engine(
            url=url,
            migrate=migrate,
            log_to_stdout=log_to_stdout,
            log_migrations=log_migrations,
        )
    elif backend is SupportedSQLDialect.POSTGRESQL:
        return aio_postgresql_engine(
            url=url,
            migrate=migrate,
            log_to_stdout=log_to_stdout,
            log_migrations=log_migrations,
        )
    else:
        assert_never(backend)


def aio_sqlite_engine(
    url: URL,
    migrate: bool = True,
    shared_cache: bool = True,
    log_to_stdout: bool = False,
    log_migrations: bool = True,
) -> AsyncEngine:
    database = url.database or ":memory:"
    if database.startswith("file:"):
        database = database[5:]
    if database.startswith(":memory:") and shared_cache:
        url = url.set(query={**url.query, "cache": "shared"}, database=":memory:")
    database = url.render_as_string().partition("///")[-1]

    engine = create_async_engine(
        url=url,
        echo=log_to_stdout,
        json_serializer=_dumps,
        # rwc, not rw. Connections are lazy, so this engine can open before the
        # migration engine has created the file -- and a `rw` connection to a
        # database that does not exist yet fails rather than waiting for it.
        async_creator=sqlite_connection_factory(database, mode="rwc"),
        # One connection, checked out exclusively. StaticPool also holds one
        # but hands it to every caller at once, and aiosqlite serialises
        # statements rather than transactions -- so concurrent sessions
        # interleaved their BEGIN/COMMIT spans and one session's commit landed
        # another's uncommitted work. Checkout expresses that exclusion where
        # the resource is; it previously lived in a lock callers had to pass.
        #
        # poolclass is explicit because the SQLite dialect otherwise defaults
        # :memory: to StaticPool and rejects the sizing arguments.
        poolclass=AsyncAdaptedQueuePool,
        pool_size=1,
        max_overflow=0,
        # None, matching the lock this replaces: writes queue indefinitely and
        # none are rejected. The 30s default would turn slow-under-contention
        # into fails-under-contention.
        pool_timeout=None,
    )
    event.listen(engine.sync_engine, "connect", set_sqlite_pragma)
    if not migrate:
        return engine
    if database.startswith(":memory:"):
        _init_memory_models(engine)
    else:
        migration_engine = create_async_engine(
            url=url,
            json_serializer=_dumps,
            # rwc: the migration engine is the only one that creates the file.
            async_creator=sqlite_connection_factory(database, mode="rwc"),
            poolclass=NullPool,
            echo=log_migrations,
        )
        migrate_in_thread(migration_engine, log_migrations=log_migrations)
    return engine


def _init_memory_models(engine: AsyncEngine) -> None:
    """
    Create the tables for an in-memory SQLite engine, returning only
    after they exist so the engine is safe to query immediately.

    This is a sync function, so it cannot await ``init_models``. There
    are two cases:

    - No event loop is running in this thread (e.g. server startup):
      ``asyncio.run`` executes the coroutine right here.
    - A loop is already running (e.g. ``launch_app`` in a notebook):
      ``asyncio.run`` would raise, and scheduling ``init_models`` as a
      task on the caller's loop would not run it until the caller next
      yields — the engine could be queried before its tables exist. So
      a short-lived helper thread runs the coroutine on its own fresh
      loop, and we block on ``join()``. Blocking the caller's loop is
      acceptable: this happens once, at engine creation, and creating
      tables in an in-memory database is fast.

    In both cases the StaticPool's single aiosqlite connection is
    created on an event loop that is closed by the time the application
    uses the engine on its own loop. That is safe because aiosqlite
    does not bind a connection to the loop it was created on: each
    operation creates a fresh future on whatever loop is current at
    call time, and the actual SQLite work runs on aiosqlite's dedicated
    worker thread either way.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(init_models(engine))
        return

    exc: BaseException | None = None

    def run() -> None:
        nonlocal exc
        try:
            asyncio.run(init_models(engine))
        except BaseException as error:
            exc = error

    thread = Thread(target=run, name="sqlite-init-models")
    thread.start()
    thread.join()
    if exc is not None:
        raise exc


def aio_postgresql_engine(
    url: URL,
    migrate: bool = True,
    log_to_stdout: bool = False,
    log_migrations: bool = True,
) -> AsyncEngine:
    from phoenix.config import (
        get_env_postgres_use_aws_iam_auth,
        get_env_postgres_use_azure_managed_identity,
    )

    use_aws = get_env_postgres_use_aws_iam_auth()
    use_azure = get_env_postgres_use_azure_managed_identity()
    if use_aws and use_azure:
        raise ValueError(
            "Cannot enable both AWS IAM and Azure managed identity authentication simultaneously. "
            "Set only one."
        )
    asyncpg_url, asyncpg_args = get_pg_config(url, enforce_ssl=use_aws or use_azure)

    # pool_pre_ping issues a `SELECT 1` on each pool checkout and discards
    # the connection if it fails, so callers don't get a stale connection
    # that was silently dropped by an upstream LB, a server failover, or a
    # DBA-initiated termination. The ping is skipped on freshly-created
    # connections, so the cost is paid only on reused ones.
    if use_azure:
        from phoenix.db.azure_auth import create_azure_engine

        logger.info("Azure managed identity enabled for PostgreSQL connections")
        engine = create_azure_engine(
            asyncpg_url,
            asyncpg_args,
            echo=log_to_stdout,
            json_serializer=_dumps,
            pool_pre_ping=True,
            pool_recycle=_POOL_RECYCLE_SECONDS,
        )
    elif use_aws:
        from phoenix.db.aws_auth import create_aws_engine

        logger.info("AWS IAM authentication enabled for PostgreSQL connections")
        engine = create_aws_engine(
            asyncpg_url,
            asyncpg_args,
            echo=log_to_stdout,
            json_serializer=_dumps,
            pool_pre_ping=True,
            pool_recycle=_POOL_RECYCLE_SECONDS,
        )
    else:
        engine = create_async_engine(
            url=asyncpg_url,
            connect_args=asyncpg_args,
            echo=log_to_stdout,
            json_serializer=_dumps,
            pool_pre_ping=True,
            pool_recycle=_POOL_RECYCLE_SECONDS,
        )

    if not migrate:
        return engine

    # Migration engines use NullPool: every checkout opens a fresh
    # connection and disposes it on return, so pool_pre_ping and
    # pool_recycle have no role — there is no reused or long-lived
    # connection to guard. The Azure branch deliberately constructs a
    # second engine (not shares the primary) so each engine owns its own
    # `DefaultAzureCredential` bound to the loop that will use it; see
    # `create_azure_engine` for the affinity invariant.
    if use_azure:
        from phoenix.db.azure_auth import create_azure_engine

        migration_engine = create_azure_engine(
            asyncpg_url,
            asyncpg_args,
            echo=log_migrations,
            json_serializer=_dumps,
            poolclass=NullPool,
        )
    elif use_aws:
        from phoenix.db.aws_auth import create_aws_engine

        migration_engine = create_aws_engine(
            asyncpg_url,
            asyncpg_args,
            echo=log_migrations,
            json_serializer=_dumps,
            poolclass=NullPool,
        )
    else:
        migration_engine = create_async_engine(
            url=asyncpg_url,
            connect_args=asyncpg_args,
            echo=log_migrations,
            json_serializer=_dumps,
            poolclass=NullPool,
        )
    migrate_in_thread(migration_engine, log_migrations=log_migrations)
    return engine


def _dumps(obj: Any) -> str:
    return orjson.dumps(obj, default=_default).decode()


def _default(obj: Any) -> Any:
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (np.integer, np.floating, np.bool_)):
        return obj.item()
    if isinstance(obj, Enum):
        return obj.value
    raise TypeError(f"Object of type {type(obj).__name__} is not serializable")
