from __future__ import annotations

import logging
from contextlib import AbstractAsyncContextManager
from typing import TYPE_CHECKING, Any, cast

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

if TYPE_CHECKING:
    import asyncpg  # type: ignore[import-untyped]
    from sqlalchemy import URL
    from types_aiobotocore_rds.client import RDSClient

logger = logging.getLogger(__name__)


def create_aws_engine(
    url: URL,
    connect_args: dict[str, Any],
    **engine_kwargs: Any,
) -> AsyncEngine:
    """
    Build an `AsyncEngine` that authenticates to PostgreSQL via AWS RDS IAM.

    Each connection attempt generates a fresh IAM token via aioboto3's
    `generate_db_auth_token`, which performs a client-side SigV4 signing
    operation over a canonical request using the AWS credentials already
    loaded in the aioboto3 session. No HTTP traffic happens inside that
    call, so per-connection generation is cheap (microseconds) and no
    application-level caching layer is needed. RDS verifies the signature
    on the server side through AWS's internal IAM machinery when the
    connection is opened, but that round-trip is paid by RDS, not by the
    client. See `internal_docs/specs/postgres-cloud-auth-pooling.md` for
    the full security and caching model.

    `**engine_kwargs` are forwarded verbatim to `create_async_engine` so
    the caller controls pool class, pre-ping, recycle, echo, etc.
    `async_creator` is supplied by this function and must not be passed
    in `engine_kwargs`.

    Unlike Azure managed identity, aioboto3 has no event-loop affinity:
    the aiohttp-bearing RDS client is built and torn down inside each
    per-connection `async with session.client("rds")` block, so the
    long-lived `aioboto3.Session` captured in the closure holds no
    loop-bound resources. A single session can safely be reused across
    multiple loops, though this function builds a new session per engine
    anyway for lifecycle cleanliness.

    Args:
        url: SQLAlchemy URL with asyncpg driver.
        connect_args: SSL and other connection arguments for asyncpg.
        **engine_kwargs: Forwarded to `create_async_engine`.

    Returns:
        A fully configured `AsyncEngine` authenticated via AWS RDS IAM.
    """
    import asyncpg

    try:
        import aioboto3  # type: ignore[import-untyped]
    except ImportError as e:
        raise ImportError(
            "aioboto3 is required for AWS RDS IAM authentication. "
            "Install it with: pip install 'arize-phoenix[aws]'"
        ) from e

    host = url.host
    port = url.port or 5432
    database = url.database or "postgres"
    # `get_async_db_url` moves username/password into the query string when both
    # are present, so check there first before falling back to `url.username`.
    query_user = url.query.get("user")
    username = query_user if isinstance(query_user, str) else url.username

    if not host:
        raise ValueError("Database host is required for AWS RDS IAM authentication")
    if not username:
        raise ValueError("Database user is required for AWS RDS IAM authentication")

    session = aioboto3.Session()

    async def async_creator() -> asyncpg.Connection:
        logger.debug(f"Generating AWS RDS IAM auth token for user '{username}' at {host}:{port}")
        # aioboto3 returns a single-use async context wrapper here; reusing
        # the same object across calls raises "cannot reuse already awaited
        # coroutine", so create a fresh client context for each connection
        # attempt.
        rds_client_context = cast(
            "AbstractAsyncContextManager[RDSClient]",
            session.client("rds"),
        )
        async with rds_client_context as rds_client:
            token = await rds_client.generate_db_auth_token(
                DBHostname=host,
                Port=port,
                DBUsername=username,
            )

        return await asyncpg.connect(
            host=host,
            port=port,
            user=username,
            password=token,
            database=database,
            **connect_args,
        )

    return create_async_engine(url=url, async_creator=async_creator, **engine_kwargs)
