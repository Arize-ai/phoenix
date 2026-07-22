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
_DELETE_BATCH_SIZE = 100


class AgentSessionSweeper(DaemonTask):
    """Periodically delete expired agent sessions."""

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
        await self._delete_expired_temporary_sessions()
        retention = self._settings.agent_session_retention
        if retention.max_idle_days > 0:
            await self._delete_idle_persisted_sessions(retention.max_idle_days)
        if retention.max_count_per_user > 0:
            await self._enforce_per_user_count_cap(retention.max_count_per_user)

    async def _delete_expired_temporary_sessions(self) -> None:
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

    async def _delete_idle_persisted_sessions(self, max_idle_days: int) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_idle_days)
        total_deleted = 0
        while True:
            batch = (
                sa.select(models.AgentSession.id)
                .where(models.AgentSession.expires_at.is_(None))
                .where(models.AgentSession.updated_at < cutoff)
                .limit(_DELETE_BATCH_SIZE)
            )
            # The batch bounds each cascading delete's transaction; repeating
            # updated_at < cutoff on the DELETE itself lets the row recheck
            # spare a session that turned active after the batch was selected.
            stmt = (
                sa.delete(models.AgentSession)
                .where(models.AgentSession.expires_at.is_(None))
                .where(models.AgentSession.updated_at < cutoff)
                .where(models.AgentSession.id.in_(batch))
            )
            async with self._db() as session:
                result = await session.execute(stmt)
            num_deleted = result.rowcount  # type: ignore[attr-defined]
            total_deleted += num_deleted
            if num_deleted < _DELETE_BATCH_SIZE:
                break
        if total_deleted:
            logger.info("Deleted %d idle agent session(s).", total_deleted)

    async def _enforce_per_user_count_cap(self, max_count_per_user: int) -> None:
        ranked = (
            sa.select(
                models.AgentSession.id,
                models.AgentSession.updated_at,
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
            .cte("ranked_agent_sessions")
        )
        # Matching on (id, updated_at) rather than id alone makes the delete's
        # row recheck fail for a session whose updated_at moved after the
        # ranking snapshot.
        stmt = sa.delete(models.AgentSession).where(
            sa.tuple_(models.AgentSession.id, models.AgentSession.updated_at).in_(
                sa.select(ranked.c.id, ranked.c.updated_at).where(
                    ranked.c.rank > max_count_per_user
                )
            )
        )
        async with self._db() as session:
            result = await session.execute(stmt)
        num_deleted = result.rowcount  # type: ignore[attr-defined]
        if num_deleted:
            logger.info("Deleted %d over-cap agent session(s).", num_deleted)
