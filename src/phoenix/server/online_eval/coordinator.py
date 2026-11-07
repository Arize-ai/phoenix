"""How evaluation consumers claim work units and record what became of them, for span,
trace, and session work.

Work-unit lifecycle:

    PENDING --claim--> RUNNING --publish--> DONE
                       RUNNING --fail-----> ERROR, or FAILED once the retry budget is spent
                       RUNNING --expire---> EXPIRED | CONTENT_LOST
                       RUNNING --clear----> DROPPED
                       RUNNING --release--> PENDING
    RUNNING (claim lease lapsed) --> reclaimable, or FAILED when no attempts remain
    ERROR (cooldown elapsed) --> retried
    PENDING | ERROR (queue cleared) --> DROPPED

Claiming is dialect-split: PostgreSQL locks candidate rows with ``FOR UPDATE SKIP
LOCKED`` so competing consumers never block on each other's candidates; SQLite (no row
locks) claims each candidate with a per-id compare-and-swap and keeps only the rows
whose update landed. Each claim first fails lapsed work with no attempts left, in the
same transaction. Every write after a claim is fenced by ``claimed_by == <the claim's
token> AND status == 'RUNNING'``.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional

from sqlalchemy import and_, case, func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement, TextClause

from phoenix.config import get_env_enable_prometheus
from phoenix.db import models
from phoenix.db.eval_work import COMPLETED_STATUSES, MAX_ATTEMPTS, queued_index_predicate
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.online_eval.clock import (
    TERMINAL_METRICS_WINDOW_SECONDS,
    current_database_time,
)
from phoenix.server.online_eval.failure_policy import FailureDisposition
from phoenix.server.online_eval.work_tables import WORK_TABLES, WorkUnitModel
from phoenix.server.prometheus import (
    ONLINE_EVAL_COMPLETED_WORK_UNITS,
    ONLINE_EVAL_QUEUE_TO_RESULT_SECONDS,
)
from phoenix.server.types import DbSessionFactory

CLAIM_LEASE_TTL_SECONDS = 90
HEARTBEAT_INTERVAL_SECONDS = 30
LEASE_ATTEMPTS_EXHAUSTED_ERROR = "lease lapsed with attempts exhausted"
TRANSIENT_RETRY_MAX_AGE_SECONDS = 86_400.0

PublicationWrite = Callable[[AsyncSession], Awaitable[None]]
"""Writes one unit's results, inside the transaction that fenced its publication."""

_DATABASE_NOW = object()
# A unit's ``created_at`` and ``updated_at`` as the transition that ended it left them.
_EndedWork = tuple[datetime, datetime]

# The completed-work counter's outcome for each status a consumer ends a unit with. The
# queue-to-result histogram observes the completed ones; cleared work had no result. User
# clears and enable are counted as "cleared" where they happen.
_COMPLETED_OUTCOMES = {
    "DONE": "evaluated",
    "FAILED": "failed",
    "EXPIRED": "expired",
    "DROPPED": "evaluator_disabled",
}


class PublicationClaimLostError(Exception):
    """A work unit stopped being publishable before its results could be written."""

    online_eval_disposition = FailureDisposition(
        count_attempt=True,
        terminal=True,
        code="PUBLICATION_CLAIM_LOST",
    )


class PublicationEvaluatorDisabledError(PublicationClaimLostError):
    """The work unit's project evaluator was turned off while the unit ran. The unit is
    cleared, as a disabled evaluator's queued work is, rather than counted as a failure."""


@dataclass(frozen=True)
class ClaimedWorkUnit:
    """A claimed work unit: one project evaluator to run against one target row."""

    work_unit_id: int
    evaluation_target: models.EvaluationTarget
    target_rowid: int
    project_evaluator_id: int
    attempts: int
    claimed_by: str


@dataclass(frozen=True)
class EndedWorkCounts:
    """Work of one evaluation target that ended without a result, last updated within
    ``TERMINAL_METRICS_WINDOW_SECONDS``: FAILED (``exhausted_error_count``), EXPIRED and
    CONTENT_LOST (``expired_count``), and DROPPED, cleared from the queue before it ran
    (``cleared_count``)."""

    exhausted_error_count: int
    expired_count: int
    cleared_count: int


def claim_lease_lapsed(
    now: datetime | ColumnElement[datetime],
    work_unit_model: WorkUnitModel = models.EvalWorkUnit,
) -> ColumnElement[bool]:
    return work_unit_model.claimed_at < now - timedelta(seconds=CLAIM_LEASE_TTL_SECONDS)


async def recover_lapsed_claims(
    session: AsyncSession,
    work_unit_model: WorkUnitModel,
    *,
    now: datetime,
    max_attempts: int,
) -> Sequence[_EndedWork]:
    """Fail RUNNING work whose claim lease lapsed with no attempts left, returning each
    failed unit's ``created_at`` and ``updated_at``: a consumer killed mid-evaluation leaves
    such a row, and no consumer may reclaim it without exceeding the retry budget."""
    result = await session.execute(
        update(work_unit_model)
        .where(
            # SQLite reads a partial index only when the query repeats its predicate.
            text(queued_index_predicate()),
            work_unit_model.status == "RUNNING",
            work_unit_model.attempts >= max_attempts - 1,
            claim_lease_lapsed(now, work_unit_model),
        )
        .values(
            status="FAILED",
            attempts=max_attempts,
            error=func.coalesce(work_unit_model.error, LEASE_ATTEMPTS_EXHAUSTED_ERROR),
        )
        .returning(work_unit_model.created_at, work_unit_model.updated_at)
    )
    return [(created_at, updated_at) for created_at, updated_at in result]


class EvalWorkCoordinator:
    """Coordinates one evaluation target's consumers across replicas.

    Heartbeat, fail, expire, clear and release return False once the claim is lost, and
    True, changing nothing, when the claim's own publication already finished the unit, so
    a call that raced that publication doesn't report a lost claim."""

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
        for outcome in (*_COMPLETED_OUTCOMES.values(), "cleared"):
            ONLINE_EVAL_COMPLETED_WORK_UNITS.labels(
                evaluation_target=evaluation_target, outcome=outcome
            )
        for status in COMPLETED_STATUSES:
            ONLINE_EVAL_QUEUE_TO_RESULT_SECONDS.labels(
                evaluation_target=evaluation_target, outcome=_COMPLETED_OUTCOMES[status]
            )
        work_table = WORK_TABLES[evaluation_target]
        self._work_unit_model = work_table.work_unit_model
        self._target_row_column = work_table.target_column
        self._target_model = work_table.target_model
        self._terminal_index_predicate = text(work_table.terminal_index_predicate)

    def _claimable(self, now: datetime) -> ColumnElement[bool]:
        work_unit_model = self._work_unit_model
        return or_(
            work_unit_model.status == "PENDING",
            and_(
                work_unit_model.status == "RUNNING",
                work_unit_model.attempts < self._max_attempts - 1,
                claim_lease_lapsed(now, work_unit_model),
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
        """Claim up to ``limit`` claimable work units for ``claimed_by``. A unit is
        claimable when it is PENDING, or RUNNING with a lapsed claim lease, or ERROR past
        its cooldown. Returns an empty sequence when no claimable work exists.

        Every later write for a unit is fenced on the ``claimed_by`` it was claimed
        with, so each call should pass a value no earlier claim used."""
        work_unit_model = self._work_unit_model
        async with self._db() as session:
            recovered = await recover_lapsed_claims(
                session,
                work_unit_model,
                now=await current_database_time(session, self._db.dialect),
                max_attempts=self._max_attempts,
            )
            now = await current_database_time(session, self._db.dialect)
            candidates = select(work_unit_model.id).where(
                # SQLite reads a partial index only when the query repeats its predicate.
                text(queued_index_predicate()),
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
        self._count_completed("FAILED", recovered)
        return [
            ClaimedWorkUnit(
                work_unit_id=row.id,
                evaluation_target=self._evaluation_target,
                target_rowid=row.target_rowid,
                project_evaluator_id=row.project_evaluator_id,
                attempts=row.attempts,
                claimed_by=claimed_by,
            )
            for row in rows
        ]

    async def heartbeat(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
    ) -> bool:
        """Renew the claim lease on a claimed unit."""
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
        """Fence a claimed unit, run ``write``, and mark the unit DONE, all in one
        transaction, so a unit is never left RUNNING with its results published.

        The fence locks the target row ``FOR KEY SHARE``, then the work unit ``FOR
        UPDATE``, the order a target delete takes as it cascades to the work unit. The unit
        must still be owned and RUNNING, and its project evaluator enabled. A deletion of
        the target either waits for the write or leaves nothing to fence.

        Raises ``PublicationClaimLostError`` when the fence fails."""
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
                    f"work unit {work_unit_id} is no longer owned and running"
                )
            project_evaluator_enabled = await session.scalar(
                select(models.ProjectEvaluator.enabled).where(
                    models.ProjectEvaluator.id == project_evaluator_id
                )
            )
            if project_evaluator_enabled is not True:
                raise PublicationEvaluatorDisabledError(
                    f"work unit {work_unit_id} project evaluator is disabled or missing"
                )
            await write(session)
            ended = await session.execute(
                update(work_unit_model)
                .where(work_unit_model.id == work_unit_id)
                .values(status="DONE")
                .returning(work_unit_model.created_at, work_unit_model.updated_at)
            )
            done = [(created_at, updated_at) for created_at, updated_at in ended]
        self._count_completed("DONE", done)

    async def fail(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
        error: str,
        cooldown_until: Optional[datetime] = None,
        count_attempt: bool = True,
    ) -> bool:
        """Transition a claimed unit RUNNING -> ERROR, or -> FAILED once the retry budget
        is spent, recording the error and setting an optional retry cooldown.
        ``count_attempt=True`` (the default) increments attempts; pass False for transient
        infrastructure failures (provider outage, network timeout) so the unit retries after
        its cooldown without ever being exhausted by an outage."""
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
        status: Literal["EXPIRED", "CONTENT_LOST"] = "EXPIRED",
    ) -> bool:
        """End a claimed unit RUNNING -> ``status`` with a stable reason."""
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claim_owner=claimed_by,
            status=status,
            error=error,
        )

    async def clear(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
        error: str,
    ) -> bool:
        """Clear a claimed unit whose project evaluator was disabled, RUNNING -> DROPPED."""
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claim_owner=claimed_by,
            status="DROPPED",
            error=error,
        )

    async def release(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
    ) -> bool:
        """Return a still-owned RUNNING unit to PENDING without incrementing attempts."""
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
            row = (
                await session.execute(
                    update(work_unit_model)
                    .where(
                        work_unit_model.id == work_unit_id,
                        work_unit_model.claimed_by == claim_owner,
                        work_unit_model.status == "RUNNING",
                    )
                    .values(**values)
                    .returning(
                        work_unit_model.status,
                        work_unit_model.created_at,
                        work_unit_model.updated_at,
                    )
                )
            ).first()
            transitioned = row is not None
            if not transitioned:
                status = await session.scalar(
                    select(work_unit_model.status).where(
                        work_unit_model.id == work_unit_id,
                        work_unit_model.claimed_by == claim_owner,
                    )
                )
                transitioned = status == "DONE"
            await session.commit()
        if row is not None:
            self._count_completed(row.status, [(row.created_at, row.updated_at)])
        return transitioned

    def _count_completed(self, status: str, ended: Sequence[_EndedWork]) -> None:
        """Count units that left the queue, and observe the lag of completed ones, once the
        transaction that ended them has committed."""
        if not self._publish_metrics or not ended:
            return
        if (outcome := _COMPLETED_OUTCOMES.get(status)) is None:
            return
        labels = {"evaluation_target": self._evaluation_target, "outcome": outcome}
        ONLINE_EVAL_COMPLETED_WORK_UNITS.labels(**labels).inc(len(ended))
        if status in COMPLETED_STATUSES:
            lag = ONLINE_EVAL_QUEUE_TO_RESULT_SECONDS.labels(**labels)
            for created_at, updated_at in ended:
                lag.observe((updated_at - created_at).total_seconds())

    async def ended_work_counts(self) -> EndedWorkCounts:
        """Count recently ended work that produced no result."""
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
            cleared_count=counts.get("DROPPED", 0),
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
