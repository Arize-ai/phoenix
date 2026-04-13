from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from os import getenv
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    import asyncpg  # type: ignore[import-untyped]
    from sqlalchemy import URL

logger = logging.getLogger(__name__)

_DEFAULT_AZURE_POSTGRESQL_SCOPE = "https://ossrdbms-aad.database.windows.net/.default"


@dataclass
class _TokenCache:
    # repr=False prevents the raw JWT from appearing in logs or exception output
    token: str | None = field(default=None, repr=False)
    expires_on: float | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


def create_azure_token_connection_creator(
    base_url: URL,
    connect_args: dict[str, Any],
) -> Callable[[], Awaitable[asyncpg.Connection]]:
    """
    Creates an async connection creator that uses cached Azure access tokens.

    Tokens are cached and refreshed automatically before expiry (5-minute buffer) to
    prevent authentication failures and reduce latency for new connections. Token acquisition
    uses exponential backoff retries (up to 3 attempts) for transient failures.
    Permanent errors (CredentialUnavailableError, ClientAuthenticationError) are re-raised
    immediately without retrying.

    Args:
        base_url: SQLAlchemy URL with asyncpg driver
        connect_args: SSL and other connection arguments for asyncpg

    Returns:
        An async callable that creates asyncpg connections with fresh Azure access tokens
    """
    import asyncpg
    from azure.core.exceptions import ClientAuthenticationError
    from azure.identity import CredentialUnavailableError
    from azure.identity.aio import DefaultAzureCredential

    from phoenix.config import ENV_PHOENIX_POSTGRES_AZURE_SCOPE

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

    scope = getenv(ENV_PHOENIX_POSTGRES_AZURE_SCOPE, _DEFAULT_AZURE_POSTGRESQL_SCOPE)

    # get_bearer_token_provider() from azure.identity.aio is not used here because it returns
    # "Bearer <token>" format (suitable for HTTP Authorization headers / OpenAI clients).
    # asyncpg's password= parameter requires the raw JWT token without the "Bearer " prefix.
    credential = DefaultAzureCredential()
    token_cache = _TokenCache()

    async def _get_cached_token() -> str:
        async with token_cache.lock:
            now = datetime.now(timezone.utc).timestamp()
            if (
                token_cache.token
                and token_cache.expires_on
                and token_cache.expires_on > now + 300  # refresh 5 minutes before expiry
            ):
                return token_cache.token

        # Fetch token outside the lock so other coroutines aren't blocked during retries.
        # A harmless race where two coroutines both refresh is acceptable; last write wins.
        for attempt in range(3):
            try:
                token_response = await credential.get_token(scope)
                acquired_at = datetime.now(timezone.utc).timestamp()
                logger.debug(
                    "Acquired Azure access token for PostgreSQL "
                    f"(expires in {(token_response.expires_on - acquired_at) / 60:.1f} minutes)"
                )
                async with token_cache.lock:
                    token_cache.token = token_response.token
                    token_cache.expires_on = token_response.expires_on
                return token_response.token
            except asyncio.CancelledError:
                raise
            except (CredentialUnavailableError, ClientAuthenticationError):
                raise
            except Exception as exc:
                if attempt < 2:
                    wait_time = 2**attempt
                    logger.warning(
                        f"Failed to acquire Azure access token (attempt {attempt + 1}/3). "
                        f"Retrying in {wait_time}s. Error: {exc}"
                    )
                    await asyncio.sleep(wait_time)
                else:
                    raise RuntimeError(
                        "Failed to acquire Azure access token after 3 attempts"
                    ) from exc
        raise RuntimeError("Unreachable")  # pragma: no cover

    async def async_creator() -> asyncpg.Connection:
        token = await _get_cached_token()
        return await asyncpg.connect(
            host=host,
            port=port,
            user=username,
            password=token,
            database=database,
            **connect_args,
        )

    return async_creator
