from __future__ import annotations

import logging
import random
from asyncio import sleep
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa

from phoenix.config import EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS
from phoenix.db import models
from phoenix.server.daemons.system_settings import SystemSettings
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_SLEEP_SECONDS = 60 * 60
_JITTER_SECONDS = 60
_DELETE_BATCH_SIZE = 100


class AgentSessionSweeper(DaemonTask):
    """Periodically delete agent sessions that have outlived their retention."""

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
        await self._delete_idle_sessions(
            is_ephemeral=True,
            max_idle=timedelta(hours=EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS),
        )
        retention = self._settings.agent_session_retention
        if retention.max_idle_days > 0:
            await self._delete_idle_sessions(
                is_ephemeral=False,
                max_idle=timedelta(days=retention.max_idle_days),
            )
        if retention.max_count_per_user > 0:
            await self._enforce_per_user_count_cap(retention.max_count_per_user)

    async def _delete_idle_sessions(self, *, is_ephemeral: bool, max_idle: timedelta) -> None:
        """Delete sessions of one persistence kind left untouched for ``max_idle``."""
        cutoff = datetime.now(timezone.utc) - max_idle
        total_deleted = 0
        while True:
            batch = (
                sa.select(models.AgentSession.id)
                .where(models.AgentSession.is_ephemeral.is_(is_ephemeral))
                .where(models.AgentSession.updated_at < cutoff)
                .limit(_DELETE_BATCH_SIZE)
            )
            # The batch bounds each cascading delete's transaction; repeating
            # updated_at < cutoff on the DELETE itself lets the row recheck
            # spare a session that turned active after the batch was selected.
            stmt = (
                sa.delete(models.AgentSession)
                .where(models.AgentSession.is_ephemeral.is_(is_ephemeral))
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
            logger.info(
                "Deleted %d idle %s agent session(s).",
                total_deleted,
                "ephemeral" if is_ephemeral else "persisted",
            )

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
            .where(models.AgentSession.is_ephemeral.is_(False))
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
