from __future__ import annotations

import logging
import random
from asyncio import sleep
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa

from phoenix.db import models
from phoenix.server.daemons.system_settings import SystemSettings
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_SLEEP_SECONDS = 60 * 60
_JITTER_SECONDS = 60


class AgentSessionSweeper(DaemonTask):
    """Periodically delete agent sessions that have outlived their lifetime.

    Each sweep runs three passes:

    1. Temporary GC — delete temporary sessions (``expires_at IS NOT NULL``)
       whose stored deadline has passed.
    2. Idle retention — delete persisted sessions idle longer than the
       workspace ``max_idle_days`` setting.
    3. Count retention — keep only the newest ``max_count_per_user`` persisted
       sessions per user.

    The retention passes read the live ``agent.assistant.session_retention``
    setting each sweep and never touch temporary sessions.
    """

    def __init__(self, db: DbSessionFactory, settings: SystemSettings) -> None:
        super().__init__()
        self._db = db
        self._settings = settings

    async def _run(self) -> None:
        while self._running:
            try:
                await self._sweep()
            except Exception:
                logger.exception("Failed to clean up expired agent sessions")
            await sleep(_SLEEP_SECONDS + random.uniform(-_JITTER_SECONDS, _JITTER_SECONDS))

    async def _sweep(self) -> None:
        await self._delete_expired_agent_sessions()
        retention = self._settings.agent_session_retention
        if retention.max_idle_days > 0:
            await self._delete_idle_persisted_sessions(retention.max_idle_days)
        if retention.max_count_per_user > 0:
            await self._enforce_per_user_count_cap(retention.max_count_per_user)

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

    async def _delete_idle_persisted_sessions(self, max_idle_days: float) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_idle_days)
        stmt = (
            sa.delete(models.AgentSession)
            .where(models.AgentSession.expires_at.is_(None))
            .where(models.AgentSession.updated_at < cutoff)
        )
        async with self._db() as session:
            result = await session.execute(stmt)
        num_deleted = result.rowcount  # type: ignore[attr-defined]
        if num_deleted:
            logger.info("Deleted %d idle agent session(s).", num_deleted)

    async def _enforce_per_user_count_cap(self, max_count_per_user: int) -> None:
        # Sessions with no user (auth disabled) are exempt from the cap.
        ranked = (
            sa.select(
                models.AgentSession.id,
                sa.func.row_number()
                .over(
                    partition_by=models.AgentSession.user_id,
                    order_by=(
                        models.AgentSession.updated_at.desc(),
                        models.AgentSession.id.desc(),
                    ),
                )
                .label("rank"),
            )
            .where(models.AgentSession.expires_at.is_(None))
            .where(models.AgentSession.user_id.is_not(None))
            .cte("ranked_agent_sessions")
        )
        stmt = sa.delete(models.AgentSession).where(
            models.AgentSession.id.in_(
                sa.select(ranked.c.id).where(ranked.c.rank > max_count_per_user)
            )
        )
        async with self._db() as session:
            result = await session.execute(stmt)
        num_deleted = result.rowcount  # type: ignore[attr-defined]
        if num_deleted:
            logger.info("Deleted %d over-cap agent session(s).", num_deleted)
