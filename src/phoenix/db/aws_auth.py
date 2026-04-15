from __future__ import annotations

import logging
from contextlib import AbstractAsyncContextManager
from typing import TYPE_CHECKING, Any, Awaitable, Callable, cast

if TYPE_CHECKING:
    import asyncpg  # type: ignore[import-untyped]
    from sqlalchemy import URL
    from types_aiobotocore_rds.client import RDSClient

logger = logging.getLogger(__name__)


def create_aws_iam_token_connection_creator(
    base_url: URL,
    connect_args: dict[str, Any],
) -> Callable[[], Awaitable[asyncpg.Connection]]:
    """
    Creates an async connection creator that uses AWS RDS IAM authentication tokens.

    A fresh IAM token is generated per connection via aioboto3's generate_db_auth_token,
    which performs a client-side SigV4 signing operation over a canonical request
    using the AWS credentials already loaded in the aioboto3 session. No HTTP traffic
    happens inside that call, so per-connection generation is cheap (microseconds)
    and no application-level caching layer is needed. RDS still verifies the
    signature on the server side through AWS's internal IAM machinery when the
    connection is opened, but that round-trip is paid by RDS, not by the client.
    See internal_docs/specs/postgres-cloud-auth-pooling.md for the full security
    and caching model.

    Args:
        base_url: SQLAlchemy URL with asyncpg driver
        connect_args: SSL and other connection arguments for asyncpg

    Returns:
        An async callable that creates asyncpg connections with fresh AWS RDS IAM tokens
    """
    import asyncpg

    try:
        import aioboto3  # type: ignore[import-untyped]
    except ImportError as e:
        raise ImportError(
            "aioboto3 is required for AWS RDS IAM authentication. "
            "Install it with: pip install 'arize-phoenix[aws]'"
        ) from e

    host = base_url.host
    port = base_url.port or 5432
    database = base_url.database or "postgres"
    username = base_url.username

    if not host:
        raise ValueError("Database host is required for AWS RDS IAM authentication")
    if not username:
        raise ValueError("Database user is required for AWS RDS IAM authentication")

    # Reuse one aioboto3 session for the factory's lifetime.
    session = aioboto3.Session()

    async def async_creator() -> asyncpg.Connection:
        logger.debug(f"Generating AWS RDS IAM auth token for user '{username}' at {host}:{port}")
        # aioboto3 returns a single-use async context wrapper here; reusing the
        # same object across calls raises "cannot reuse already awaited coroutine",
        # so create a fresh client context for each connection attempt.
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

    return async_creator
