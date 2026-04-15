from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Awaitable, Callable

from phoenix.config import get_env_postgres_azure_scope

if TYPE_CHECKING:
    import asyncpg  # type: ignore[import-untyped]
    from sqlalchemy import URL

logger = logging.getLogger(__name__)


def create_azure_token_connection_creator(
    base_url: URL,
    connect_args: dict[str, Any],
) -> Callable[[], Awaitable[asyncpg.Connection]]:
    """
    Creates an async connection creator that uses Azure managed-identity access tokens.

    One `DefaultAzureCredential` instance is reused for the factory lifetime so
    each connection attempt can call `credential.get_token(scope)` while relying
    on azure-identity's built-in in-memory cache and refresh behavior.

    Args:
        base_url: SQLAlchemy URL with asyncpg driver
        connect_args: SSL and other connection arguments for asyncpg

    Returns:
        An async callable that creates asyncpg connections with fresh Azure access tokens
    """
    import asyncpg

    try:
        from azure.identity.aio import DefaultAzureCredential
    except ImportError as e:
        raise ImportError(
            "azure-identity is required for Azure managed identity authentication. "
            "Install it with: pip install 'arize-phoenix[azure]'"
        ) from e

    host = base_url.host
    port = base_url.port or 5432
    database = base_url.database
    username = base_url.query.get("user") or base_url.username

    if not host:
        raise ValueError("Database host is required for Azure managed identity authentication")
    if not database:
        raise ValueError("Database name is required for Azure managed identity authentication")
    if not username:
        raise ValueError("Database username is required for Azure managed identity authentication")

    scope = get_env_postgres_azure_scope()

    # One credential is reused for the factory's lifetime: constructing a new
    # DefaultAzureCredential per connection would re-probe every auth source and
    # add token-fetch latency. The credential is intentionally not closed on
    # shutdown — engine.dispose() only tears down DB connections, and wiring a
    # dedicated lifecycle hook isn't worth it for a process-lifetime singleton.
    credential = DefaultAzureCredential()

    async def async_creator() -> asyncpg.Connection:
        token_response = await credential.get_token(scope)
        logger.debug("Acquired Azure access token for PostgreSQL")
        return await asyncpg.connect(
            host=host,
            port=port,
            user=username,
            password=token_response.token,
            database=database,
            **connect_args,
        )

    return async_creator
