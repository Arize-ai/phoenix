"""Database-backed ``EvalWorkCoordinator`` for span, session, and trace work units.

Claiming is dialect-split: PostgreSQL locks candidate rows with ``FOR UPDATE SKIP
LOCKED`` so competing consumers never block on each other's candidates; SQLite (no row
locks) claims each candidate with a per-id compare-and-swap and keeps only the rows
whose update landed. Each claim first fails lapsed work with no attempts left, in the
same transaction; while such rows exist, a claim can wait on another claim's reap.
Every post-claim write (heartbeat / publish / fail / expire / release) is fenced by
``claimed_by == <the claim's token> AND status == 'RUNNING'``. Publication writes the
results and marks the unit DONE in its fenced transaction; a transition that misses the
fence returns False, unless the unit is DONE under the same token, which counts as
success so that a write racing its own claim's publication doesn't report a lost claim.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Mapping, Optional, Sequence

from sqlalchemy import and_, case, func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement, TextClause
from typing_extensions import assert_never

from phoenix.config import get_env_enable_prometheus
from phoenix.db import models
from phoenix.db.eval_work import (
    MAX_ATTEMPTS,
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
    EndedWorkCounts,
    PublicationClaimLostError,
    PublicationWrite,
    RetiredWorkStatus,
)
from phoenix.server.online_eval.leases import current_database_time
from phoenix.server.prometheus import ONLINE_EVAL_COMPLETED_WORK_UNITS
from phoenix.server.types import DbSessionFactory

TRANSIENT_RETRY_MAX_AGE_SECONDS = 86_400.0

_WorkUnitModel = (
    type[models.EvalWorkUnit] | type[models.EvalSessionWorkUnit] | type[models.EvalTraceWorkUnit]
)
_TargetModel = type[models.Span] | type[models.ProjectSession] | type[models.Trace]
_DATABASE_NOW = object()

# The statuses a unit leaves the queue with that the completed-work counter reports. Cleared
# is DROPPED by any path: a clear, a toggle, or hydration after the evaluator was turned off.
_COMPLETED_OUTCOMES = {
    "DONE": "evaluated",
    "FAILED": "failed",
    "EXPIRED": "expired",
    "DROPPED": "cleared",
}


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
) -> int:
    """Fail RUNNING work whose lease lapsed with no attempts left, returning how many units:
    a consumer killed mid-evaluation leaves such a row, and no consumer may reclaim it
    without exceeding the retry budget."""
    result = await session.execute(
        update(work_unit_model)
        .where(
            # SQLite reads a partial index only when the query repeats its predicate.
            text(live_eval_work_index_predicate()),
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
    return int(result.rowcount)  # type: ignore[attr-defined]


async def drop_queued_work(
    session: AsyncSession,
    project_evaluator_ids: Sequence[int],
) -> dict[models.EvaluationTarget, int]:
    """Drop the project evaluators' work that has not started, returning how many units of
    each evaluation target.

    Queued work is PENDING, or ERROR awaiting a retry. RUNNING work is left alone: an
    enabled evaluator's evaluation should finish, and publication refuses a disabled
    one's. The status guard also skips a unit a consumer claims concurrently.
    """
    return await _drop_queued_work(session, project_evaluator_ids)


async def drop_all_queued_work(session: AsyncSession) -> dict[models.EvaluationTarget, int]:
    """Drop every project evaluator's work that has not started, returning how many units
    of each evaluation target, as ``drop_queued_work`` does for some."""
    return await _drop_queued_work(session, None)


async def _drop_queued_work(
    session: AsyncSession,
    project_evaluator_ids: Optional[Sequence[int]],
) -> dict[models.EvaluationTarget, int]:
    dropped: dict[models.EvaluationTarget, int] = {}
    work_unit_models: dict[models.EvaluationTarget, _WorkUnitModel] = {
        "SPAN": models.EvalWorkUnit,
        "TRACE": models.EvalTraceWorkUnit,
        "SESSION": models.EvalSessionWorkUnit,
    }
    for evaluation_target, work_unit_model in work_unit_models.items():
        statement = update(work_unit_model).where(
            # SQLite reads a partial index only when the query repeats its predicate.
            text(live_eval_work_index_predicate()),
            work_unit_model.status.in_(("PENDING", "ERROR")),
        )
        if project_evaluator_ids is not None:
            statement = statement.where(
                work_unit_model.project_evaluator_id.in_(project_evaluator_ids)
            )
        result = await session.execute(statement.values(status="DROPPED"))
        dropped[evaluation_target] = result.rowcount  # type: ignore[attr-defined]
    return dropped


def count_cleared_work(dropped: Mapping[models.EvaluationTarget, int]) -> None:
    """Count work a user cleared, once the transaction that dropped it has committed."""
    if not get_env_enable_prometheus():
        return
    for evaluation_target, count in dropped.items():
        if count:
            ONLINE_EVAL_COMPLETED_WORK_UNITS.labels(
                evaluation_target=evaluation_target, outcome=_COMPLETED_OUTCOMES["DROPPED"]
            ).inc(count)


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
        self._publish_metrics = get_env_enable_prometheus()
        for outcome in _COMPLETED_OUTCOMES.values():
            ONLINE_EVAL_COMPLETED_WORK_UNITS.labels(
                evaluation_target=evaluation_target, outcome=outcome
            )
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
            assert_never(evaluation_target)

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
            reaped_count = await reap_lapsed_leases(
                session,
                work_unit_model,
                now=await current_database_time(session, self._db.dialect),
                max_attempts=self._max_attempts,
            )
            now = await current_database_time(session, self._db.dialect)
            candidates = select(work_unit_model.id).where(
                # SQLite reads a partial index only when the query repeats its predicate.
                text(live_eval_work_index_predicate()),
                self._claimable(now),
            )
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
                            work_unit_model.project_evaluator_id,
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
        self._count_completed("FAILED", reaped_count)
        lease_expires_at = now + timedelta(seconds=LEASE_TTL_SECONDS)
        return [
            ClaimedWorkUnit(
                work_unit_id=row.id,
                evaluation_target=self._evaluation_target,
                target_rowid=row.target_rowid,
                project_evaluator_id=row.project_evaluator_id,
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

    async def publish(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
        write: PublicationWrite,
    ) -> None:
        """Lock the target row ``FOR KEY SHARE``, then the work unit ``FOR UPDATE``: the
        order a target delete takes as it cascades to the work unit. The project evaluator
        is read without a lock."""
        work_unit_model = self._work_unit_model
        target_model = self._target_model
        async with self._db() as session:
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
            await session.execute(
                update(work_unit_model)
                .where(work_unit_model.id == work_unit_id)
                .values(status="DONE")
            )
        self._count_completed("DONE")

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
        **values: Any,
    ) -> bool:
        work_unit_model = self._work_unit_model
        async with self._db() as session:
            if values.get("claimed_at") is _DATABASE_NOW:
                values["claimed_at"] = await current_database_time(session, self._db.dialect)
            new_status = await session.scalar(
                update(work_unit_model)
                .where(
                    work_unit_model.id == work_unit_id,
                    work_unit_model.claimed_by == claim_owner,
                    work_unit_model.status == "RUNNING",
                )
                .values(**values)
                .returning(work_unit_model.status)
            )
            transitioned = new_status is not None
            if not transitioned:
                status = await session.scalar(
                    select(work_unit_model.status).where(
                        work_unit_model.id == work_unit_id,
                        work_unit_model.claimed_by == claim_owner,
                    )
                )
                transitioned = status == "DONE"
            await session.commit()
        if new_status is not None:
            self._count_completed(new_status)
        return transitioned

    def _count_completed(self, status: str, count: int = 1) -> None:
        """Count units that left the queue, once the transaction that ended them has
        committed."""
        if not self._publish_metrics or not count:
            return
        if (outcome := _COMPLETED_OUTCOMES.get(status)) is not None:
            ONLINE_EVAL_COMPLETED_WORK_UNITS.labels(
                evaluation_target=self._evaluation_target, outcome=outcome
            ).inc(count)

    async def ended_work_counts(self) -> EndedWorkCounts:
        now = datetime.now(timezone.utc)
        work_unit_model = self._work_unit_model
        async with self._db.read() as session:
            counts = await self._count_by_status(
                session,
                self._terminal_index_predicate,
                work_unit_model.updated_at
                >= now - timedelta(seconds=TERMINAL_METRICS_WINDOW_SECONDS),
            )
        return EndedWorkCounts(
            exhausted_error_count=counts.get("FAILED", 0),
            expired_count=sum(counts.get(status, 0) for status in ("EXPIRED", "CONTENT_LOST")),
            dropped_count=counts.get("DROPPED", 0),
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
