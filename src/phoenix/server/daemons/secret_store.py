from __future__ import annotations

import logging
from asyncio import sleep
from datetime import datetime, timedelta, timezone
from typing import Callable, Iterable, Optional

import sqlalchemy as sa

from phoenix.config import getenv
from phoenix.db import models
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)


class SecretStore(DaemonTask):
    """A daemon that periodically fetches secrets and maintains an in-memory cache.

    This daemon runs continuously in the background, periodically fetching secrets
    from the database and updating an in-memory cache. The cache is used by the
    application to resolve secret lookups without hitting the database on every access.

    Thread Safety:
    --------------
    The _store dict is accessed by multiple asyncio tasks:
    - Read access: get() method (called from request handlers)
    - Write access: _merge() method (called from background refresh task)

    This implementation relies on Python's GIL for thread safety:
    - Dict operations (.get(), .pop(), assignment) are atomic in CPython
    - The background task only updates individual keys, never replaces the entire dict
    - Read operations during updates may see slightly stale data (eventual consistency)

    This is acceptable because:
    1. Secrets are refreshed frequently (default: every 5 seconds)
    2. Brief staleness (milliseconds) is tolerable for secret lookups
    3. If a secret is not found in cache, it falls back to environment variables

    Note: If running on alternative Python implementations without a GIL,
    explicit locking would be required.
    """

    def __init__(
        self,
        db: DbSessionFactory,
        decrypt: Callable[[bytes], bytes],
        refresh_interval_seconds: int = 5,
    ) -> None:
        super().__init__()
        self._db = db
        self._decrypt = decrypt
        self._store: dict[str, str] = {}
        self._last_fetch_time: Optional[datetime] = None
        self._refresh_interval_seconds = refresh_interval_seconds

    def get(self, key: str) -> str | None:
        """Get a secret value by key.

        Thread-safe read from cache. Returns None if not found in cache,
        falling back to environment variable lookup.

        Args:
            key: The secret key to look up

        Returns:
            The secret value if found, None otherwise
        """
        if value := self._store.get(key):
            return value
        return getenv(key)

    async def _run(self) -> None:
        while self._running:
            # two seconds buffer to avoid race and clock skew issues
            fetch_start_time = datetime.now(timezone.utc) - timedelta(seconds=2)
            try:
                await self._fetch()
            except Exception:
                logger.exception("Failed to refresh secrets")
            else:
                self._last_fetch_time = fetch_start_time
            await sleep(self._refresh_interval_seconds)

    def _merge(self, secrets: Iterable[models.Secret]) -> None:
        for secret in secrets:
            if secret.deleted_at:
                self._store.pop(secret.key, None)
            elif secret.value is not None:
                try:
                    value = self._decrypt(secret.value).decode("utf-8")
                except Exception:
                    self._store.pop(secret.key, None)
                else:
                    self._store[secret.key] = value
            else:
                self._store.pop(secret.key, None)

    async def _fetch(self) -> None:
        """
        Fetch secrets from the database.
        """
        stmt = sa.select(models.Secret)
        if self._last_fetch_time:
            stmt = stmt.where(
                sa.or_(
                    models.Secret.updated_at >= self._last_fetch_time,
                    models.Secret.deleted_at >= self._last_fetch_time,
                )
            )
        async with self._db() as session:
            secrets = (await session.scalars(stmt)).all()
        if not secrets:
            return
        self._merge(secrets)
