from __future__ import annotations

import logging
import random
from asyncio import sleep
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa

from phoenix.config import TEMPORARY_AGENT_SESSION_TIME_TO_LIVE_HOURS
from phoenix.db import models
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_SLEEP_SECONDS = 60 * 60
_JITTER_SECONDS = 60


class AgentSessionSweeper(DaemonTask):
    """Periodically delete inactive temporary agent sessions."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__()
        self._db = db

    async def _run(self) -> None:
        while self._running:
            try:
                await self._delete_temporary_agent_sessions()
            except Exception:
                logger.exception("Failed to clean up temporary agent sessions")
            await sleep(_SLEEP_SECONDS + random.uniform(-_JITTER_SECONDS, _JITTER_SECONDS))

    async def _delete_temporary_agent_sessions(self) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(
            hours=TEMPORARY_AGENT_SESSION_TIME_TO_LIVE_HOURS
        )
        stmt = (
            sa.delete(models.AgentSession)
            .where(models.AgentSession.is_temporary.is_(True))
            .where(models.AgentSession.updated_at < cutoff)
            .returning(models.AgentSession.id)
        )
        async with self._db() as session:
            num_deleted = len((await session.scalars(stmt)).all())
        if num_deleted:
            logger.info(f"Deleted {num_deleted} temporary agent session(s).")
