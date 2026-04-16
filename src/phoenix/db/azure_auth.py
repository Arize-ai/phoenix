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
    lifecycle to the returned engine: `await engine.dispose()` will also
    close the credential. The extra `**engine_kwargs` are forwarded verbatim
    to `sqlalchemy.ext.asyncio.create_async_engine` so the caller controls
    pool class, pre-ping, recycle, echo, etc. `async_creator` is supplied
    by this function and must not be passed in `engine_kwargs`.

    Event-loop affinity: `azure.identity.aio` credentials lazily construct
    an `aiohttp.ClientSession` on first `get_token`, and that session is
    bound to whichever event loop was running at the time. The credential
    therefore must be *closed* on the same loop that first used it. Because
    this function hooks the credential's `close` into `engine.dispose()`,
    the usual `await engine.dispose()` shutdown path handles that cleanup
    automatically — provided `dispose` is awaited on the loop that opened
    the connections.

    The practical implication for callers that run both a migration engine
    (inside a throwaway `asyncio.run(...)` loop) and a long-lived server
    engine (inside uvicorn's loop): **call `create_azure_engine` twice**,
    once per engine, so each engine owns its own credential bound to its
    own loop. Sharing a single credential across the two loops is the bug
    documented in `internal_docs/specs/postgres-cloud-auth-pooling.md`
    (section "Event-loop affinity of azure.identity.aio credentials") and
    surfaces as `RuntimeError: Event loop is closed` on the server's first
    connection-open.

    Args:
        url: SQLAlchemy URL with asyncpg driver.
        connect_args: SSL and other connection arguments for asyncpg.
        **engine_kwargs: Forwarded to `create_async_engine` (pool class,
            `pool_pre_ping`, `pool_recycle`, `echo`, `json_serializer`, ...).

    Returns:
        A fully configured `AsyncEngine` whose `dispose()` tears down the
        pool *and* closes the underlying Azure credential.
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

    # Monkey-patch `engine.dispose` on this instance (not the class) so
    # shutting down the engine also closes our credential on whatever loop
    # the dispose is awaited on. Instance-dict assignment shadows the class
    # method via normal attribute lookup; it only works if SQLAlchemy always
    # invokes dispose via `engine.dispose(...)` rather than
    # `type(engine).dispose(engine)`, which is true today.
    original_dispose = engine.dispose

    async def dispose_and_close_credential(*args: Any, **kwargs: Any) -> Any:
        try:
            return await original_dispose(*args, **kwargs)
        finally:
            await credential.close()

    engine.dispose = dispose_and_close_credential  # type: ignore[method-assign]

    return engine
