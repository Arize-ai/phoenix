"""Database-backed ``EvalWorkCoordinator`` for span, session, and trace work units.

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

from sqlalchemy import and_, case, func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement, TextClause

from phoenix.db import models
from phoenix.db.eval_work import (
    live_eval_work_index_predicate,
    terminal_eval_session_work_index_predicate,
    terminal_eval_work_index_predicate,
)
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.online_eval.coordinator import (
    LEASE_ATTEMPTS_EXHAUSTED_ERROR,
    LEASE_TTL_SECONDS,
    TERMINAL_METRICS_WINDOW_SECONDS,
    ClaimedWorkUnit,
    PublicationClaimLostError,
    PublicationWrite,
    QueueLag,
    RetiredWorkStatus,
)
from phoenix.server.online_eval.derivation import MAX_ATTEMPTS, annotation_identifier
from phoenix.server.online_eval.leases import current_database_time
from phoenix.server.types import DbSessionFactory

TRANSIENT_RETRY_MAX_AGE_SECONDS = 86_400.0

_WorkUnitModel = (
    type[models.EvalWorkUnit] | type[models.EvalSessionWorkUnit] | type[models.EvalTraceWorkUnit]
)
_TargetModel = type[models.Span] | type[models.ProjectSession] | type[models.Trace]
_DATABASE_NOW = object()


def work_unit_lease_lapsed(
    now: datetime | ColumnElement[datetime],
    work_unit_model: _WorkUnitModel = models.EvalWorkUnit,
) -> ColumnElement[bool]:
    return work_unit_model.claimed_at < now - timedelta(seconds=LEASE_TTL_SECONDS)


async def reap_lapsed_leases(
    session: AsyncSession,
    work_unit_model: _WorkUnitModel,
    *,
    now: datetime,
    max_attempts: int,
) -> None:
    """Fail RUNNING work whose lease lapsed with no attempts left: a consumer killed
    mid-evaluation leaves such a row, and no consumer may reclaim it without exceeding
    the retry budget."""
    await session.execute(
        update(work_unit_model)
        .where(
            work_unit_model.status == "RUNNING",
            work_unit_model.attempts >= max_attempts - 1,
            work_unit_lease_lapsed(now, work_unit_model),
        )
        .values(
            status="FAILED",
            attempts=max_attempts,
            error=func.coalesce(work_unit_model.error, LEASE_ATTEMPTS_EXHAUSTED_ERROR),
        )
    )


class DbEvalWorkCoordinator:
    """Coordinates online-eval consumers through the selected work-unit table."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        evaluation_target: models.EvaluationTarget = "SPAN",
        max_attempts: int = MAX_ATTEMPTS,
    ) -> None:
        self._db = db
        self._evaluation_target: models.EvaluationTarget = evaluation_target
        self._max_attempts = max_attempts
        if evaluation_target == "SPAN":
            self._work_unit_model: _WorkUnitModel = models.EvalWorkUnit
            self._target_row_column: InstrumentedAttribute[int] = models.EvalWorkUnit.span_rowid
            self._target_model: _TargetModel = models.Span
            self._terminal_index_predicate = text(terminal_eval_work_index_predicate())
        elif evaluation_target == "SESSION":
            self._work_unit_model = models.EvalSessionWorkUnit
            self._target_row_column = models.EvalSessionWorkUnit.project_session_rowid
            self._target_model = models.ProjectSession
            self._terminal_index_predicate = text(terminal_eval_session_work_index_predicate())
        elif evaluation_target == "TRACE":
            self._work_unit_model = models.EvalTraceWorkUnit
            self._target_row_column = models.EvalTraceWorkUnit.trace_rowid
            self._target_model = models.Trace
            self._terminal_index_predicate = text(terminal_eval_session_work_index_predicate())
        else:
            raise ValueError(
                f"Online evaluation work coordination does not support {evaluation_target}"
            )

    def _claimable(self, now: datetime) -> ColumnElement[bool]:
        work_unit_model = self._work_unit_model
        return or_(
            work_unit_model.status == "PENDING",
            and_(
                work_unit_model.status == "RUNNING",
                work_unit_model.attempts < self._max_attempts - 1,
                work_unit_lease_lapsed(now, work_unit_model),
            ),
            and_(
                work_unit_model.status == "ERROR",
                or_(
                    work_unit_model.cooldown_until.is_(None),
                    work_unit_model.cooldown_until <= now,
                ),
            ),
        )

    async def claim(
        self,
        *,
        claimed_by: str,
        limit: int,
    ) -> Sequence[ClaimedWorkUnit]:
        work_unit_model = self._work_unit_model
        async with self._db() as session:
            now = await current_database_time(session, self._db.dialect)
            await reap_lapsed_leases(
                session, work_unit_model, now=now, max_attempts=self._max_attempts
            )
            candidates = select(work_unit_model.id).where(self._claimable(now))
            candidates = candidates.order_by(work_unit_model.id).limit(limit)
            claim_values = {
                "status": "RUNNING",
                "claimed_at": now,
                "claimed_by": claimed_by,
                # A straggler outliving the stop() drain is counted.
                "attempts": case(
                    (
                        work_unit_model.status == "RUNNING",
                        work_unit_model.attempts + 1,
                    ),
                    else_=work_unit_model.attempts,
                ),
            }
            claimed_ids: list[int] = []
            if self._db.dialect is SupportedSQLDialect.POSTGRESQL:
                locked_ids = (
                    await session.scalars(candidates.with_for_update(skip_locked=True))
                ).all()
                if locked_ids:
                    await session.execute(
                        update(work_unit_model)
                        .where(work_unit_model.id.in_(locked_ids))
                        .values(**claim_values)
                    )
                    claimed_ids = list(locked_ids)
            else:
                for unit_id in (await session.scalars(candidates)).all():
                    cas = await session.execute(
                        update(work_unit_model)
                        .where(work_unit_model.id == unit_id, self._claimable(now))
                        .values(**claim_values)
                    )
                    if cas.rowcount == 1:  # type: ignore[attr-defined]
                        claimed_ids.append(unit_id)
            rows = (
                (
                    await session.execute(
                        select(
                            work_unit_model.id,
                            self._target_row_column.label("target_rowid"),
                            work_unit_model.evaluator_id,
                            work_unit_model.project_evaluator_id,
                            work_unit_model.config_fingerprint,
                            work_unit_model.attempts,
                        )
                        .where(work_unit_model.id.in_(claimed_ids))
                        .order_by(work_unit_model.id)
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
                evaluation_target=self._evaluation_target,
                target_rowid=row.target_rowid,
                evaluator_id=row.evaluator_id,
                project_evaluator_id=row.project_evaluator_id,
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
            claim_owner=claimed_by,
            claimed_at=_DATABASE_NOW,
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
            claim_owner=claimed_by,
            already_status="DONE",
            status="DONE",
        )

    async def publish(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
        write: PublicationWrite,
    ) -> None:
        work_unit_model = self._work_unit_model
        target_model = self._target_model
        async with self._db() as session:
            # Deletes lock the target, then cascade to the work unit; lock in the same order.
            await session.execute(
                select(target_model.id)
                .where(
                    target_model.id
                    == select(self._target_row_column)
                    .where(work_unit_model.id == work_unit_id)
                    .scalar_subquery()
                )
                .with_for_update(read=True, key_share=True)
            )
            project_evaluator_id = await session.scalar(
                select(work_unit_model.project_evaluator_id)
                .where(
                    work_unit_model.id == work_unit_id,
                    work_unit_model.claimed_by == claimed_by,
                    work_unit_model.status == "RUNNING",
                )
                .with_for_update()
            )
            if project_evaluator_id is None:
                raise PublicationClaimLostError(
                    f"work unit {work_unit_id} is no longer owned and live"
                )
            project_evaluator_enabled = await session.scalar(
                select(models.ProjectEvaluator.enabled).where(
                    models.ProjectEvaluator.id == project_evaluator_id
                )
            )
            if project_evaluator_enabled is not True:
                raise PublicationClaimLostError(
                    f"work unit {work_unit_id} project evaluator is disabled or missing"
                )
            await write(session)

    async def fail(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
        error: str,
        cooldown_until: Optional[datetime] = None,
        count_attempt: bool = True,
    ) -> bool:
        work_unit_model = self._work_unit_model
        attempts: Any
        if count_attempt:
            attempts = work_unit_model.attempts + 1
        else:
            async with self._db.read() as session:
                database_now = await current_database_time(session, self._db.dialect)
            retry_age_cutoff = database_now - timedelta(seconds=TRANSIENT_RETRY_MAX_AGE_SECONDS)
            attempts = case(
                (work_unit_model.created_at < retry_age_cutoff, self._max_attempts),
                else_=work_unit_model.attempts,
            )
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claim_owner=claimed_by,
            status=case((attempts >= self._max_attempts, "FAILED"), else_="ERROR"),
            attempts=attempts,
            error=error,
            cooldown_until=cooldown_until,
        )

    async def expire(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
        error: str,
        status: RetiredWorkStatus = "EXPIRED",
    ) -> bool:
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claim_owner=claimed_by,
            status=status,
            error=error,
        )

    async def release(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
    ) -> bool:
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claim_owner=claimed_by,
            status="PENDING",
            claimed_at=None,
            claimed_by=None,
            cooldown_until=None,
            error=None,
        )

    async def _fenced_transition(
        self,
        *,
        work_unit_id: int,
        claim_owner: str,
        already_status: Optional[str] = None,
        **values: Any,
    ) -> bool:
        work_unit_model = self._work_unit_model
        async with self._db() as session:
            if values.get("claimed_at") is _DATABASE_NOW:
                values["claimed_at"] = await current_database_time(session, self._db.dialect)
            result = await session.execute(
                update(work_unit_model)
                .where(
                    work_unit_model.id == work_unit_id,
                    work_unit_model.claimed_by == claim_owner,
                    work_unit_model.status == "RUNNING",
                )
                .values(**values)
            )
            rowcount = result.rowcount  # type: ignore[attr-defined]
            transitioned = bool(rowcount == 1)
            if not transitioned and already_status is not None:
                status = await session.scalar(
                    select(work_unit_model.status).where(work_unit_model.id == work_unit_id)
                )
                transitioned = status == already_status
            await session.commit()
            return transitioned

    async def lag(self) -> QueueLag:
        now = datetime.now(timezone.utc)
        work_unit_model = self._work_unit_model
        # SQLite reads through a partial index only when the query repeats the index's
        # predicate literally; a bound IN list does not match it.
        live = text(live_eval_work_index_predicate())
        async with self._db.read() as session:
            live_counts = await self._count_by_status(session, live)
            terminal_counts = await self._count_by_status(
                session,
                self._terminal_index_predicate,
                work_unit_model.updated_at
                >= now - timedelta(seconds=TERMINAL_METRICS_WINDOW_SECONDS),
            )
            oldest_work_created_at = await session.scalar(
                select(work_unit_model.created_at)
                .where(live, work_unit_model.status.in_(("PENDING", "ERROR")))
                .order_by(work_unit_model.created_at)
                .limit(1)
            )
        oldest_actionable_age_seconds = (
            max((now - oldest_work_created_at).total_seconds(), 0.0)
            if oldest_work_created_at is not None
            else None
        )
        return QueueLag(
            pending_count=live_counts.get("PENDING", 0),
            running_count=live_counts.get("RUNNING", 0),
            retryable_error_count=live_counts.get("ERROR", 0),
            exhausted_error_count=terminal_counts.get("FAILED", 0),
            expired_count=sum(
                terminal_counts.get(status, 0)
                for status in ("EXPIRED", "SUPERSEDED", "CONTENT_LOST")
            ),
            oldest_actionable_age_seconds=oldest_actionable_age_seconds,
        )

    async def _count_by_status(
        self,
        session: AsyncSession,
        *where: ColumnElement[bool] | TextClause,
    ) -> dict[str, int]:
        work_unit_model = self._work_unit_model
        rows = await session.execute(
            select(work_unit_model.status, func.count())
            .where(*where)
            .group_by(work_unit_model.status)
        )
        return {status: count for status, count in rows.all()}
