from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from phoenix.config import get_env_postgres_azure_scope

if TYPE_CHECKING:
    import asyncpg  # type: ignore[import-untyped]
    from sqlalchemy import URL

logger = logging.getLogger(__name__)


def create_azure_engine(
    url: URL,
    connect_args: dict[str, Any],
    **engine_kwargs: Any,
) -> AsyncEngine:
    """
    Build an `AsyncEngine` that authenticates to PostgreSQL via Azure
    managed identity.

    Each call constructs its own `DefaultAzureCredential` and ties its
    lifecycle to the returned engine: `await engine.dispose()` also closes
    the credential. `**engine_kwargs` are forwarded to `create_async_engine`
    so the caller controls pool class, pre-ping, recycle, echo, etc.
    `async_creator` is supplied by this function and must not be passed in
    `engine_kwargs`.

    Event-loop affinity: `azure.identity.aio` lazily pins its internal
    `aiohttp.ClientSession` to the loop running at first `get_token()` and
    must be *closed* on that same loop. Callers that build both a migration
    engine (throwaway `asyncio.run(...)` loop) and a server engine (uvicorn
    loop) must therefore call this function **once per engine** so each
    engine owns a credential bound to its own loop.

    Args:
        url: SQLAlchemy URL with asyncpg driver.
        connect_args: SSL and other connection arguments for asyncpg.
        **engine_kwargs: Forwarded to `create_async_engine`.

    Returns:
        An `AsyncEngine` whose `dispose()` tears down the pool and closes
        the underlying Azure credential.
    """
    import asyncpg

    try:
        from azure.identity.aio import DefaultAzureCredential
    except ImportError as e:
        raise ImportError(
            "azure-identity is required for Azure managed identity authentication. "
            "Install it with: pip install 'arize-phoenix[azure]'"
        ) from e

    host = url.host
    port = url.port or 5432
    database = url.database
    # `get_async_db_url` moves username/password into the query string when both
    # are present, so check there first before falling back to `url.username`.
    query_user = url.query.get("user")
    username = query_user if isinstance(query_user, str) else url.username

    if not host:
        raise ValueError("Database host is required for Azure managed identity authentication")
    if not database:
        raise ValueError("Database name is required for Azure managed identity authentication")
    if not username:
        raise ValueError("Database username is required for Azure managed identity authentication")

    scope = get_env_postgres_azure_scope()
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

    engine = create_async_engine(url=url, async_creator=async_creator, **engine_kwargs)

    # Patch `dispose` on this instance so shutting down the engine also
    # closes the credential on the loop that awaited dispose. Relies on
    # callers invoking `engine.dispose(...)` (instance attribute lookup)
    # rather than `type(engine).dispose(engine)` (class lookup).
    original_dispose = engine.dispose

    async def dispose_and_close_credential(*args: Any, **kwargs: Any) -> Any:
        try:
            return await original_dispose(*args, **kwargs)
        finally:
            await credential.close()

    engine.dispose = dispose_and_close_credential  # type: ignore[method-assign]

    return engine
