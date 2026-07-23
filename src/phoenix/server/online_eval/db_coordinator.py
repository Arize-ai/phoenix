"""Database-backed ``EvalWorkCoordinator`` over the ``eval_work_units`` table.

Claiming is dialect-split: PostgreSQL locks candidate rows with ``FOR UPDATE SKIP
LOCKED`` so competing consumers never block on each other's claims; SQLite (no row
locks) claims each candidate with a per-id compare-and-swap and keeps only the rows
whose update landed. Every post-claim transition (heartbeat / complete / fail /
expire) is fenced by ``claimed_by == me AND status == 'RUNNING'`` and reports a lost
claim as False via the update rowcount.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Sequence

from sqlalchemy import and_, case, func, or_, select, update
from sqlalchemy.sql.elements import ColumnElement

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.online_eval.coordinator import (
    LEASE_TTL_SECONDS,
    ClaimedWorkUnit,
    QueueLag,
)
from phoenix.server.online_eval.derivation import MAX_ATTEMPTS, annotation_identifier
from phoenix.server.types import DbSessionFactory

_CONSUMER_GROUP = "default"
TRANSIENT_RETRY_MAX_AGE_SECONDS = 86_400.0
STALE_FINGERPRINT_ERROR = "stale config fingerprint"


def work_unit_lease_lapsed(now: datetime) -> ColumnElement[bool]:
    return models.EvalWorkUnit.claimed_at < now - timedelta(seconds=LEASE_TTL_SECONDS)


class DbEvalWorkCoordinator:
    """Coordinates online-eval consumers through ``eval_work_units`` row state."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        evaluation_target: models.EvaluationTarget = "SPAN",
        max_attempts: int = MAX_ATTEMPTS,
    ) -> None:
        self._db = db
        self._evaluation_target = evaluation_target
        self._max_attempts = max_attempts

    def _claimable(self, now: datetime) -> ColumnElement[bool]:
        return or_(
            models.EvalWorkUnit.status == "PENDING",
            and_(
                models.EvalWorkUnit.status == "RUNNING",
                models.EvalWorkUnit.attempts < self._max_attempts - 1,
                work_unit_lease_lapsed(now),
            ),
            and_(
                models.EvalWorkUnit.status == "ERROR",
                models.EvalWorkUnit.attempts < self._max_attempts,
                or_(
                    models.EvalWorkUnit.cooldown_until.is_(None),
                    models.EvalWorkUnit.cooldown_until <= now,
                ),
            ),
        )

    async def claim(
        self,
        *,
        claimed_by: str,
        limit: int,
    ) -> Sequence[ClaimedWorkUnit]:
        now = datetime.now(timezone.utc)
        async with self._db() as session:
            candidates = select(models.EvalWorkUnit.id).where(self._claimable(now))
            candidates = candidates.order_by(models.EvalWorkUnit.id).limit(limit)
            claim_values = {
                "status": "RUNNING",
                "claimed_at": now,
                "claimed_by": claimed_by,
                # A straggler outliving the stop() drain is counted.
                "attempts": case(
                    (
                        models.EvalWorkUnit.status == "RUNNING",
                        models.EvalWorkUnit.attempts + 1,
                    ),
                    else_=models.EvalWorkUnit.attempts,
                ),
            }
            claimed_ids: list[int] = []
            if self._db.dialect is SupportedSQLDialect.POSTGRESQL:
                locked_ids = (
                    await session.scalars(candidates.with_for_update(skip_locked=True))
                ).all()
                if locked_ids:
                    await session.execute(
                        update(models.EvalWorkUnit)
                        .where(models.EvalWorkUnit.id.in_(locked_ids))
                        .values(**claim_values)
                    )
                    claimed_ids = list(locked_ids)
            else:
                for unit_id in (await session.scalars(candidates)).all():
                    cas = await session.execute(
                        update(models.EvalWorkUnit)
                        .where(models.EvalWorkUnit.id == unit_id, self._claimable(now))
                        .values(**claim_values)
                    )
                    if cas.rowcount == 1:  # type: ignore[attr-defined]
                        claimed_ids.append(unit_id)
            rows = (
                (
                    await session.execute(
                        select(
                            models.EvalWorkUnit.id,
                            models.EvalWorkUnit.span_rowid,
                            models.EvalWorkUnit.evaluator_id,
                            models.EvalWorkUnit.criteria_id,
                            models.EvalWorkUnit.config_fingerprint,
                            models.EvalWorkUnit.attempts,
                        )
                        .where(models.EvalWorkUnit.id.in_(claimed_ids))
                        .order_by(models.EvalWorkUnit.id)
                    )
                ).all()
                if claimed_ids
                else []
            )
            await session.commit()
        lease_expires_at = now + timedelta(seconds=LEASE_TTL_SECONDS)
        return [
            ClaimedWorkUnit(
                work_unit_id=row.id,
                span_rowid=row.span_rowid,
                evaluator_id=row.evaluator_id,
                criteria_id=row.criteria_id,
                config_fingerprint=row.config_fingerprint,
                identifier=annotation_identifier(row.config_fingerprint),
                attempts=row.attempts,
                claimed_by=claimed_by,
                lease_expires_at=lease_expires_at,
            )
            for row in rows
        ]

    async def heartbeat(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
    ) -> bool:
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claimed_by=claimed_by,
            claimed_at=datetime.now(timezone.utc),
        )

    async def complete(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
    ) -> bool:
        """Complete a claimed unit, treating an already-DONE row as success."""
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claimed_by=claimed_by,
            already_status="DONE",
            status="DONE",
        )

    async def fail(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
        error: str,
        cooldown_until: Optional[datetime] = None,
        count_attempt: bool = True,
    ) -> bool:
        values: dict[str, Any] = {
            "error": error,
            "cooldown_until": cooldown_until,
        }
        if count_attempt:
            values["attempts"] = models.EvalWorkUnit.attempts + 1
        else:
            retry_age_cutoff = datetime.now(timezone.utc) - timedelta(
                seconds=TRANSIENT_RETRY_MAX_AGE_SECONDS
            )
            values["attempts"] = case(
                (models.EvalWorkUnit.created_at < retry_age_cutoff, self._max_attempts),
                else_=models.EvalWorkUnit.attempts,
            )
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claimed_by=claimed_by,
            status="ERROR",
            **values,
        )

    async def expire(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
    ) -> bool:
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claimed_by=claimed_by,
            status="EXPIRED",
            error=STALE_FINGERPRINT_ERROR,
        )

    async def _fenced_transition(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
        already_status: Optional[str] = None,
        **values: Any,
    ) -> bool:
        async with self._db() as session:
            result = await session.execute(
                update(models.EvalWorkUnit)
                .where(
                    models.EvalWorkUnit.id == work_unit_id,
                    models.EvalWorkUnit.claimed_by == claimed_by,
                    models.EvalWorkUnit.status == "RUNNING",
                )
                .values(**values)
            )
            rowcount = result.rowcount  # type: ignore[attr-defined]
            transitioned = bool(rowcount == 1)
            if not transitioned and already_status is not None:
                status = await session.scalar(
                    select(models.EvalWorkUnit.status).where(models.EvalWorkUnit.id == work_unit_id)
                )
                transitioned = status == already_status
            await session.commit()
            return transitioned

    async def lag(self) -> QueueLag:
        now = datetime.now(timezone.utc)
        async with self._db.read() as session:
            error_exhausted = case(
                (
                    and_(
                        models.EvalWorkUnit.status == "ERROR",
                        models.EvalWorkUnit.attempts >= self._max_attempts,
                    ),
                    True,
                ),
                else_=False,
            ).label("error_exhausted")
            counts: dict[tuple[str, bool], int] = {
                (status, exhausted): count
                for status, exhausted, count in (
                    await session.execute(
                        select(models.EvalWorkUnit.status, error_exhausted, func.count())
                        .where(
                            models.EvalWorkUnit.status.in_(
                                ["PENDING", "RUNNING", "ERROR", "EXPIRED"]
                            )
                        )
                        .group_by(models.EvalWorkUnit.status, error_exhausted)
                    )
                ).all()
            }
            oldest_work_created_at = await session.scalar(
                select(models.EvalWorkUnit.created_at)
                .where(
                    or_(
                        models.EvalWorkUnit.status == "PENDING",
                        and_(
                            models.EvalWorkUnit.status == "ERROR",
                            models.EvalWorkUnit.attempts < self._max_attempts,
                        ),
                    )
                )
                .order_by(models.EvalWorkUnit.created_at)
                .limit(1)
            )
            cursor = (
                await session.execute(
                    select(
                        models.EvalWorkCursor.produced_through_id,
                        models.EvalWorkCursor.observed_high_water_id,
                    ).where(
                        models.EvalWorkCursor.evaluation_target == self._evaluation_target,
                        models.EvalWorkCursor.consumer_group == _CONSUMER_GROUP,
                    )
                )
            ).first()
        frontier_gap = 0
        if cursor is not None and cursor.observed_high_water_id is not None:
            frontier_gap = max(cursor.observed_high_water_id - cursor.produced_through_id, 0)
        oldest_pending_age_seconds = (
            max((now - oldest_work_created_at).total_seconds(), 0.0)
            if oldest_work_created_at is not None
            else None
        )
        return QueueLag(
            pending_count=counts.get(("PENDING", False), 0),
            running_count=counts.get(("RUNNING", False), 0),
            retryable_error_count=counts.get(("ERROR", False), 0),
            exhausted_error_count=counts.get(("ERROR", True), 0),
            expired_count=counts.get(("EXPIRED", False), 0),
            frontier_gap=frontier_gap,
            oldest_pending_age_seconds=oldest_pending_age_seconds,
        )
