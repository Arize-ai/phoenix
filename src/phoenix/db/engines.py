from __future__ import annotations

import asyncio
import logging
from enum import Enum
from sqlite3 import Connection
from typing import Any

import aiosqlite
import numpy as np
import orjson
import sqlean
from sqlalchemy import URL, NullPool, StaticPool, event, make_url
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from typing_extensions import assert_never

from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.migrate import migrate_in_thread
from phoenix.db.models import init_models
from phoenix.db.pg_config import get_pg_config

sqlean.extensions.enable("text", "stats")

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


def set_sqlite_pragma(connection: Connection, _: Any) -> None:
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = OFF;")
    cursor.execute("PRAGMA cache_size = -32000;")
    cursor.execute("PRAGMA busy_timeout = 10000;")
    cursor.close()


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

    def async_creator() -> aiosqlite.Connection:
        conn = aiosqlite.Connection(
            lambda: sqlean.connect(f"file:{database}", uri=True),
            iter_chunk_size=64,
        )
        conn.daemon = True
        return conn

    engine = create_async_engine(
        url=url,
        echo=log_to_stdout,
        json_serializer=_dumps,
        async_creator=async_creator,
        poolclass=StaticPool,
    )
    event.listen(engine.sync_engine, "connect", set_sqlite_pragma)
    if not migrate:
        return engine
    if database.startswith(":memory:"):
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            asyncio.run(init_models(engine))
        else:
            asyncio.create_task(init_models(engine))
    else:
        migration_engine = create_async_engine(
            url=url,
            json_serializer=_dumps,
            async_creator=async_creator,
            poolclass=NullPool,
            echo=log_migrations,
        )
        migrate_in_thread(migration_engine, log_migrations=log_migrations)
    return engine


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
