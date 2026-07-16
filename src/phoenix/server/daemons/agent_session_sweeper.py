from __future__ import annotations

import logging
import random
from asyncio import sleep
from datetime import datetime, timezone

import sqlalchemy as sa

from phoenix.db import models
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_SLEEP_SECONDS = 60 * 60
_JITTER_SECONDS = 60


class AgentSessionSweeper(DaemonTask):
    """Periodically delete expired temporary agent sessions."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__()
        self._db = db

    async def _run(self) -> None:
        while self._running:
            try:
                await self._delete_expired_agent_sessions()
            except Exception:
                logger.exception("Failed to clean up expired agent sessions")
            await sleep(_SLEEP_SECONDS + random.uniform(-_JITTER_SECONDS, _JITTER_SECONDS))

    async def _delete_expired_agent_sessions(self) -> None:
        stmt = (
            sa.delete(models.AgentSession)
            .where(models.AgentSession.expires_at.is_not(None))
            .where(models.AgentSession.expires_at < datetime.now(timezone.utc))
            .returning(models.AgentSession.id)
        )
        async with self._db() as session:
            num_deleted = len((await session.scalars(stmt)).all())
        if num_deleted:
            logger.info("Deleted %d expired agent session(s).", num_deleted)
