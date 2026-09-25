"""Leases that keep one replica at a time running each online-eval materializer."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from sqlalchemy import func, or_, select, type_coerce, update
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.types import DbSessionFactory

logger = logging.getLogger(__name__)

MATERIALIZER_LEASE_TTL_SECONDS = 90.0


async def current_database_time(session: AsyncSession, dialect: SupportedSQLDialect) -> datetime:
    if dialect is SupportedSQLDialect.POSTGRESQL:
        clock = func.statement_timestamp()
    else:
        clock = func.strftime("%Y-%m-%d %H:%M:%f", "now")
    now = await session.scalar(select(type_coerce(clock, models.UtcTimeStamp())))
    if now is None:
        raise RuntimeError("Database did not return its current time")
    return now


class MaterializerLease:
    """A named row in ``eval_work_leases``, held by ``holder`` while its heartbeat stays
    fresh by the database clock."""

    def __init__(self, db: DbSessionFactory, *, name: str, holder: str) -> None:
        self._db = db
        self.name = name
        self.holder = holder
        self._held = False

    async def acquire(self) -> bool:
        """Take the lease if it is free, stale, or already ours."""
        async with self._db() as session:
            now = await current_database_time(session, self._db.dialect)
            lease_id = await session.scalar(
                update(models.EvalWorkLease)
                .where(
                    models.EvalWorkLease.name == self.name,
                    or_(
                        models.EvalWorkLease.holder.is_(None),
                        models.EvalWorkLease.holder == self.holder,
                        models.EvalWorkLease.heartbeat_at
                        < now - timedelta(seconds=MATERIALIZER_LEASE_TTL_SECONDS),
                    ),
                )
                .values(holder=self.holder, heartbeat_at=now)
                .returning(models.EvalWorkLease.id)
            )
            if lease_id is None and not self._db.should_not_insert_or_update:
                lease_id = await session.scalar(
                    insert_on_conflict(
                        {"name": self.name, "holder": self.holder, "heartbeat_at": now},
                        table=models.EvalWorkLease,
                        dialect=self._db.dialect,
                        unique_by=("name",),
                        on_conflict=OnConflict.DO_NOTHING,
                    ).returning(models.EvalWorkLease.id)
                )
        self._held = lease_id is not None
        return self._held

    async def renew(self) -> bool:
        """Refresh the heartbeat, returning False if another replica has taken the lease."""
        async with self._db() as session:
            now = await current_database_time(session, self._db.dialect)
            lease_id = await session.scalar(
                update(models.EvalWorkLease)
                .where(
                    models.EvalWorkLease.name == self.name,
                    models.EvalWorkLease.holder == self.holder,
                )
                .values(heartbeat_at=now)
                .returning(models.EvalWorkLease.id)
            )
        self._held = lease_id is not None
        if not self._held:
            logger.warning(f"Lost the online-eval {self.name} lease")
        return self._held

    async def release(self) -> None:
        """Hand the lease back so the next holder need not wait out the TTL."""
        if not self._held:
            return
        self._held = False
        try:
            async with self._db() as session:
                await session.execute(
                    update(models.EvalWorkLease)
                    .where(
                        models.EvalWorkLease.name == self.name,
                        models.EvalWorkLease.holder == self.holder,
                    )
                    .values(holder=None, heartbeat_at=None)
                )
        except Exception:
            logger.exception(f"Failed to release the online-eval {self.name} lease")
