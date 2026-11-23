"""Coordinator for the specialized polymorphic ``cleanup_tasks`` queue.

Coordinates bounded single-batch data-reclamation steps across replicas:
- At most one claimed cleanup task deployment-wide (gated on PostgreSQL by a transaction-scoped
  advisory lock during the ~1 ms claim transaction, and on SQLite by its single writer pool).
- Each claimed step locks its ``cleanup_tasks`` row through the batch commit (``FOR NO KEY
  UPDATE NOWAIT`` on PostgreSQL; immediate conditional fencing write on SQLite), so claim
  recovery never reassigns an active database step even if its lease expires mid-batch.
- Completed tasks are deleted inside the finalization transaction alongside their target
  tombstone; failed or temporarily contended steps reschedule via durable ``available_at``.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from secrets import token_hex
from typing import Literal, Optional

from sqlalchemy import (
    ColumnElement,
    and_,
    delete,
    exists,
    func,
    literal,
    not_,
    or_,
    select,
    text,
    update,
)
from sqlalchemy.exc import DBAPIError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, with_polymorphic
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.cleanup_tasks import (
    claimed_cleanup_tasks_predicate,
    unclaimed_cleanup_tasks_predicate,
)
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import get_sqlstate
from phoenix.server.cleanup.primitives import (
    CLEANUP_BATCH_ROWS,
    PrimitiveResult,
    PrimitiveStatus,
    drain_dataset_evaluator_dependents_step,
    drain_eval_work_units_step,
    drain_project_annotation_config_links_step,
    drain_trace_scope_step,
)
from phoenix.server.dml_event import DmlEvent, ProjectDeleteEvent, SpanDeleteEvent
from phoenix.server.online_eval.clock import current_database_time
from phoenix.server.types import CanPutItem, DbSessionFactory

logger = logging.getLogger(__name__)

# Distinct from ModelCostManifest's 0x70686F656E6978 ("phoenix").
_CLEANUP_ADMISSION_LOCK_ID = 0x636C6E705F717565  # "clnp_que"

CLAIM_LEASE_TTL_SECONDS = 90.0
YIELD_DELAY_SECONDS = 0.25
ERROR_RETRY_DELAY_SECONDS = 15.0
MAX_ERROR_RETRY_DELAY_SECONDS = 3600.0
STATEMENT_TIMEOUT_MS = 60_000
LOCK_TIMEOUT_MS = 5_000
_TRANSIENT_CONTENTION_SQLSTATES = frozenset({"55P03", "40P01"})


class _ClaimLostError(Exception):
    """Raised when a cleanup step loses ownership of its claimed task row before commit."""


@dataclass(frozen=True)
class ClaimedCleanupTask:
    task_id: int
    kind: models.CleanupTaskKind
    claimed_by: str


StepOutcome: TypeAlias = Literal["progress", "yield", "completed", "claim_lost", "error"]


@dataclass(frozen=True)
class StepExecutionResult:
    outcome: StepOutcome
    affected_rows: int = 0


def _ineligible_waiting_delete_predicate() -> ColumnElement[bool]:
    """Fixed ordering rule:
    - Exclude ``DELETE_PROJECT`` while any ``project_evaluators`` row still references that
      owner project.
    """
    project_delete_task = aliased(models.ProjectDeleteCleanupTask)
    project_evaluator = aliased(models.ProjectEvaluator)

    return and_(
        models.CleanupTask.kind == "DELETE_PROJECT",
        exists(
            select(literal(1))
            .select_from(project_delete_task)
            .where(
                project_delete_task.id == models.CleanupTask.id,
                exists(
                    select(literal(1)).where(
                        project_evaluator.project_id == project_delete_task.project_id
                    )
                ),
            )
        ),
    )


class CleanupCoordinator:
    """Coordinates ``cleanup_tasks`` claims, bounded batch execution, and recovery."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        event_queue: Optional[CanPutItem[DmlEvent]] = None,
        batch_limit: int = CLEANUP_BATCH_ROWS,
        lease_ttl_seconds: float = CLAIM_LEASE_TTL_SECONDS,
        yield_delay_seconds: float = YIELD_DELAY_SECONDS,
        error_retry_delay_seconds: float = ERROR_RETRY_DELAY_SECONDS,
        worker_prefix: str = "cleanup-worker",
    ) -> None:
        self._db = db
        self._event_queue = event_queue
        self._batch_limit = batch_limit
        self._lease_ttl_seconds = lease_ttl_seconds
        self._yield_delay_seconds = yield_delay_seconds
        self._error_retry_delay_seconds = error_retry_delay_seconds
        self._worker_prefix = worker_prefix

    def _new_claim_token(self) -> str:
        return f"{self._worker_prefix}-{token_hex(8)}"

    def _compute_error_retry_delay_seconds(self, *, num_prior_failures: int) -> float:
        return float(
            min(
                self._error_retry_delay_seconds * 2 ** min(num_prior_failures, 20),
                max(self._error_retry_delay_seconds, MAX_ERROR_RETRY_DELAY_SECONDS),
            )
        )

    async def _next_eligible_delay_seconds(
        self,
        session: AsyncSession,
        *,
        now: datetime,
    ) -> Optional[float]:
        next_available_at = await session.scalar(
            select(models.CleanupTask.available_at)
            .where(
                text(unclaimed_cleanup_tasks_predicate()),
                not_(_ineligible_waiting_delete_predicate()),
            )
            .order_by(models.CleanupTask.available_at.asc(), models.CleanupTask.id.asc())
            .limit(1)
        )
        if next_available_at is None:
            return None
        return max(0.0, (next_available_at - now).total_seconds())

    async def claim_next(self) -> Optional[ClaimedCleanupTask]:
        """Recover unlocked lapsed claims and claim at most one eligible task deployment-wide."""
        claimed, _ = await self._claim_next_or_delay()
        return claimed

    async def _claim_next_or_delay(
        self,
    ) -> tuple[Optional[ClaimedCleanupTask], Optional[float]]:
        dialect = self._db.dialect
        token = self._new_claim_token()

        async with self._db() as session:
            if dialect is SupportedSQLDialect.POSTGRESQL:
                await session.execute(
                    select(func.pg_advisory_xact_lock(_CLEANUP_ADMISSION_LOCK_ID))
                )
            else:
                # Acquire SQLite's writer lock before reading claim state so a cross-connection
                # test or tool never attempts a stale WAL read-to-write snapshot upgrade.
                await session.execute(
                    update(models.CleanupTask)
                    .where(models.CleanupTask.id == -1)
                    .values(claimed_by=None)
                )

            now = await current_database_time(session, dialect)
            lapsed_cutoff = now - timedelta(seconds=self._lease_ttl_seconds)

            lapsed_stmt = (
                select(models.CleanupTask.id, models.CleanupTask.failure_count)
                .where(
                    text(claimed_cleanup_tasks_predicate()),
                    models.CleanupTask.claimed_at <= lapsed_cutoff,
                )
                .order_by(models.CleanupTask.claimed_at.asc(), models.CleanupTask.id.asc())
            )
            if dialect is SupportedSQLDialect.POSTGRESQL:
                lapsed_stmt = lapsed_stmt.with_for_update(key_share=True, skip_locked=True)
            lapsed_rows = (await session.execute(lapsed_stmt)).all()
            if lapsed_rows:
                recovered_task_ids: list[int] = []
                for lapsed_row in lapsed_rows:
                    lapsed_task_id = int(lapsed_row.id)
                    num_failures = int(lapsed_row.failure_count)
                    retry_delay_seconds = self._compute_error_retry_delay_seconds(
                        num_prior_failures=num_failures
                    )
                    recovered = await session.execute(
                        update(models.CleanupTask)
                        .where(
                            models.CleanupTask.id == lapsed_task_id,
                            text(claimed_cleanup_tasks_predicate()),
                            models.CleanupTask.claimed_at <= lapsed_cutoff,
                        )
                        .values(
                            claimed_at=None,
                            claimed_by=None,
                            available_at=now + timedelta(seconds=retry_delay_seconds),
                            failure_count=num_failures + 1,
                        )
                    )
                    if getattr(recovered, "rowcount", 0) == 1:
                        recovered_task_ids.append(lapsed_task_id)
                if recovered_task_ids:
                    logger.warning(
                        "Recovered %d expired cleanup task claim(s): %s",
                        len(recovered_task_ids),
                        recovered_task_ids,
                    )

            active_claimed = int(
                (
                    await session.scalar(
                        select(func.count(models.CleanupTask.id)).where(
                            text(claimed_cleanup_tasks_predicate())
                        )
                    )
                )
                or 0
            )
            if active_claimed >= 1:
                return None, None

            candidate_stmt = (
                select(models.CleanupTask.id, models.CleanupTask.kind)
                .where(
                    text(unclaimed_cleanup_tasks_predicate()),
                    models.CleanupTask.available_at <= now,
                    not_(_ineligible_waiting_delete_predicate()),
                )
                .order_by(models.CleanupTask.available_at.asc(), models.CleanupTask.id.asc())
                .limit(1)
            )
            if dialect is SupportedSQLDialect.POSTGRESQL:
                candidate_stmt = candidate_stmt.with_for_update(key_share=True, skip_locked=True)
                row = (await session.execute(candidate_stmt)).first()
                if row is None:
                    next_delay = await self._next_eligible_delay_seconds(session, now=now)
                    return None, next_delay
                task_id, kind = int(row.id), row.kind
                await session.execute(
                    update(models.CleanupTask)
                    .where(models.CleanupTask.id == task_id)
                    .values(claimed_at=now, claimed_by=token)
                )
                return ClaimedCleanupTask(task_id=task_id, kind=kind, claimed_by=token), None

            row = (await session.execute(candidate_stmt)).first()
            if row is None:
                next_delay = await self._next_eligible_delay_seconds(session, now=now)
                return None, next_delay
            task_id, kind = int(row.id), row.kind
            cas = await session.execute(
                update(models.CleanupTask)
                .where(
                    models.CleanupTask.id == task_id,
                    text(unclaimed_cleanup_tasks_predicate()),
                    models.CleanupTask.available_at <= now,
                )
                .values(claimed_at=now, claimed_by=token)
            )
            if getattr(cas, "rowcount", 0) != 1:
                return None, None
            return ClaimedCleanupTask(task_id=task_id, kind=kind, claimed_by=token), None

    async def execute_claimed_step(self, claimed: ClaimedCleanupTask) -> StepExecutionResult:
        """Execute one protected batch transaction for ``claimed``."""
        dialect = self._db.dialect
        events_after_commit: list[DmlEvent] = []
        was_cancelled = False
        try:
            async with self._db() as session:
                try:
                    if dialect is SupportedSQLDialect.POSTGRESQL:
                        await session.execute(
                            text(f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}")
                        )
                        await session.execute(text(f"SET LOCAL lock_timeout = {LOCK_TIMEOUT_MS}"))
                        now = await current_database_time(session, dialect)
                        lease_floor = now - timedelta(seconds=self._lease_ttl_seconds)
                        try:
                            locked_id = await session.scalar(
                                select(models.CleanupTask.id)
                                .where(
                                    models.CleanupTask.id == claimed.task_id,
                                    models.CleanupTask.claimed_by == claimed.claimed_by,
                                    models.CleanupTask.claimed_at > lease_floor,
                                )
                                .with_for_update(key_share=True, nowait=True)
                            )
                        except DBAPIError as exc:
                            if get_sqlstate(exc) == "55P03":  # lock_not_available
                                return StepExecutionResult("claim_lost")
                            raise
                        if locked_id is None:
                            return StepExecutionResult("claim_lost")
                    else:
                        now = await current_database_time(session, dialect)
                        lease_floor = now - timedelta(seconds=self._lease_ttl_seconds)
                        # Conditional write first so SQLite acquires RESERVED/IMMEDIATE lock
                        # before any SELECT touches a table B-tree.
                        fenced = await session.execute(
                            update(models.CleanupTask)
                            .where(
                                models.CleanupTask.id == claimed.task_id,
                                models.CleanupTask.claimed_by == claimed.claimed_by,
                                models.CleanupTask.claimed_at > lease_floor,
                            )
                            .values(claimed_at=now)
                        )
                        if getattr(fenced, "rowcount", 0) != 1:
                            return StepExecutionResult("claim_lost")

                    poly = with_polymorphic(models.CleanupTask, "*")
                    task = await session.scalar(
                        select(poly).where(models.CleanupTask.id == claimed.task_id)
                    )
                    if task is None:
                        return StepExecutionResult("claim_lost")

                    step_result = await self._run_domain_step(
                        session,
                        dialect=dialect,
                        task=task,
                        events_after_commit=events_after_commit,
                    )
                    step_done_now = await current_database_time(session, dialect)
                    if step_result.status is PrimitiveStatus.PROGRESS:
                        await self._release_claim(
                            session, claimed, available_at=step_done_now, reset_failures=True
                        )
                        outcome = StepExecutionResult("progress", step_result.affected_rows)
                    elif step_result.status is PrimitiveStatus.YIELD:
                        await self._release_claim(
                            session,
                            claimed,
                            available_at=step_done_now
                            + timedelta(seconds=self._yield_delay_seconds),
                        )
                        outcome = StepExecutionResult("yield", 0)
                    elif step_result.status is PrimitiveStatus.EMPTY:
                        outcome = StepExecutionResult("completed", step_result.affected_rows)
                    else:
                        assert_never(step_result.status)
                except asyncio.CancelledError:
                    was_cancelled = True
                    raise
        except asyncio.CancelledError:
            await asyncio.shield(self._release_claim_on_cancel(claimed))
            raise
        except _ClaimLostError:
            return StepExecutionResult("claim_lost", 0)
        except SQLAlchemyError as exc:
            if was_cancelled:
                await asyncio.shield(self._release_claim_on_cancel(claimed))
                raise asyncio.CancelledError from exc
            if isinstance(exc, DBAPIError) and get_sqlstate(exc) in _TRANSIENT_CONTENTION_SQLSTATES:
                # A writer holds or deadlocked on the rows this step needs; retry shortly without
                # counting a failure.
                await self._record_step_yield(claimed)
                return StepExecutionResult("yield", 0)
            logger.exception(
                "Cleanup task %s (kind=%s, claim=%s) batch failed; scheduling retry",
                claimed.task_id,
                claimed.kind,
                claimed.claimed_by,
            )
            await self._record_step_failure(claimed)
            return StepExecutionResult("error", 0)

        if self._event_queue is not None:
            for event in events_after_commit:
                self._event_queue.put(event)
        return outcome

    async def _release_claim(
        self,
        session: AsyncSession,
        claimed: ClaimedCleanupTask,
        *,
        available_at: datetime,
        reset_failures: bool = False,
    ) -> None:
        """Release ``claimed`` only if it is still held by this claim token."""
        released = await session.execute(
            update(models.CleanupTask)
            .where(
                models.CleanupTask.id == claimed.task_id,
                models.CleanupTask.claimed_by == claimed.claimed_by,
            )
            .values(
                claimed_at=None,
                claimed_by=None,
                available_at=available_at,
                **({"failure_count": 0} if reset_failures else {}),
            )
        )
        if getattr(released, "rowcount", 0) != 1:
            raise _ClaimLostError(f"cleanup task {claimed.task_id} claim was lost mid-step")

    async def _release_claim_on_cancel(self, claimed: ClaimedCleanupTask) -> None:
        try:
            async with self._db() as session:
                now = await current_database_time(session, self._db.dialect)
                await self._release_claim(
                    session,
                    claimed,
                    available_at=now,
                )
        except _ClaimLostError:
            return
        except SQLAlchemyError:
            logger.warning(
                "Failed to release claim for cancelled cleanup task %s (claim=%s); "
                "lease recovery will reschedule it",
                claimed.task_id,
                claimed.claimed_by,
                exc_info=True,
            )

    async def _record_step_yield(self, claimed: ClaimedCleanupTask) -> None:
        try:
            async with self._db() as session:
                now = await current_database_time(session, self._db.dialect)
                await self._release_claim(
                    session,
                    claimed,
                    available_at=now + timedelta(seconds=self._yield_delay_seconds),
                )
        except _ClaimLostError:
            return
        except SQLAlchemyError:
            logger.exception(
                "Failed to record yield for cleanup task %s (claim=%s); "
                "lease recovery will reschedule it",
                claimed.task_id,
                claimed.claimed_by,
            )

    async def _record_step_failure(self, claimed: ClaimedCleanupTask) -> None:
        """Reschedule a failed step with a delay that doubles per consecutive failure."""
        dialect = self._db.dialect
        try:
            async with self._db() as session:
                now = await current_database_time(session, dialect)
                num_failures = await session.scalar(
                    select(models.CleanupTask.failure_count).where(
                        models.CleanupTask.id == claimed.task_id,
                        models.CleanupTask.claimed_by == claimed.claimed_by,
                    )
                )
                if num_failures is None:
                    return
                retry_delay_seconds = self._compute_error_retry_delay_seconds(
                    num_prior_failures=int(num_failures)
                )
                await session.execute(
                    update(models.CleanupTask)
                    .where(
                        models.CleanupTask.id == claimed.task_id,
                        models.CleanupTask.claimed_by == claimed.claimed_by,
                    )
                    .values(
                        claimed_at=None,
                        claimed_by=None,
                        available_at=now + timedelta(seconds=retry_delay_seconds),
                        failure_count=int(num_failures) + 1,
                    )
                )
        except SQLAlchemyError:
            logger.exception(
                "Failed to record retry delay for cleanup task %s (claim=%s); "
                "lease recovery will reschedule it",
                claimed.task_id,
                claimed.claimed_by,
            )

    async def _run_domain_step(
        self,
        session: AsyncSession,
        *,
        dialect: SupportedSQLDialect,
        task: models.CleanupTask,
        events_after_commit: list[DmlEvent],
    ) -> PrimitiveResult:
        if isinstance(task, models.ProjectDeleteCleanupTask):
            return await self._step_project_delete(
                session,
                dialect=dialect,
                task=task,
                events_after_commit=events_after_commit,
            )
        if isinstance(task, models.ProjectEvaluatorCleanupTask):
            return await self._step_project_evaluator_delete(
                session,
                dialect=dialect,
                task=task,
                events_after_commit=events_after_commit,
            )
        if isinstance(task, models.DatasetEvaluatorCleanupTask):
            return await self._step_dataset_evaluator_delete(
                session,
                dialect=dialect,
                task=task,
                events_after_commit=events_after_commit,
            )
        raise RuntimeError(f"Unsupported cleanup task instance: {type(task)!r}")

    async def _step_project_delete(
        self,
        session: AsyncSession,
        *,
        dialect: SupportedSQLDialect,
        task: models.ProjectDeleteCleanupTask,
        events_after_commit: list[DmlEvent],
    ) -> PrimitiveResult:
        project_id = task.project_id
        # Recheck fixed ordering invariants before draining/finalizing.
        has_bindings = bool(
            await session.scalar(
                select(exists().where(models.ProjectEvaluator.project_id == project_id))
            )
        )
        if has_bindings:
            return PrimitiveResult(PrimitiveStatus.YIELD, 0)

        annotation_config_res = await drain_project_annotation_config_links_step(
            session,
            dialect=dialect,
            project_id=project_id,
            batch_limit=self._batch_limit,
        )
        if annotation_config_res.status is not PrimitiveStatus.EMPTY:
            return annotation_config_res

        trace_res = await drain_trace_scope_step(
            session,
            dialect=dialect,
            project_id=project_id,
            batch_limit=self._batch_limit,
            rehome_shared_sessions=True,
        )
        if trace_res.status is PrimitiveStatus.PROGRESS:
            events_after_commit.append(SpanDeleteEvent((project_id,)))
            return trace_res
        if trace_res.status is PrimitiveStatus.YIELD:
            return trace_res

        # Lock the project row FOR UPDATE before final residual checks and deletion.
        if dialect is SupportedSQLDialect.POSTGRESQL:
            await session.execute(
                select(models.Project.id).where(models.Project.id == project_id).with_for_update()
            )
        residual = bool(
            await session.scalar(
                select(
                    or_(
                        exists().where(models.Trace.project_rowid == project_id),
                        exists().where(models.ProjectSession.project_id == project_id),
                        exists().where(models.ProjectEvaluator.project_id == project_id),
                        exists().where(models.ProjectEvaluator.trace_project_id == project_id),
                        exists().where(models.DatasetEvaluators.project_id == project_id),
                    )
                )
            )
        )
        if residual:
            return PrimitiveResult(PrimitiveStatus.YIELD, 0)

        # Delete the base cleanup task first (cascading to project_delete_cleanup_tasks and
        # releasing its RESTRICT FK on projects.id), then delete the project row.
        await session.execute(delete(models.CleanupTask).where(models.CleanupTask.id == task.id))
        await session.execute(delete(models.Project).where(models.Project.id == project_id))
        events_after_commit.append(SpanDeleteEvent((project_id,)))
        events_after_commit.append(ProjectDeleteEvent((project_id,)))
        return PrimitiveResult(PrimitiveStatus.EMPTY, 1)

    async def _step_project_evaluator_delete(
        self,
        session: AsyncSession,
        *,
        dialect: SupportedSQLDialect,
        task: models.ProjectEvaluatorCleanupTask,
        events_after_commit: list[DmlEvent],
    ) -> PrimitiveResult:
        binding_id = task.project_evaluator_id
        trace_project_id = await session.scalar(
            select(models.ProjectEvaluator.trace_project_id).where(
                models.ProjectEvaluator.id == binding_id
            )
        )
        if trace_project_id is None:
            await session.execute(
                delete(models.CleanupTask).where(models.CleanupTask.id == task.id)
            )
            return PrimitiveResult(PrimitiveStatus.EMPTY, 0)

        work_res = await drain_eval_work_units_step(
            session,
            dialect=dialect,
            project_evaluator_id=binding_id,
            batch_limit=self._batch_limit,
        )
        if work_res.status is not PrimitiveStatus.EMPTY:
            return work_res

        annotation_config_res = await drain_project_annotation_config_links_step(
            session,
            dialect=dialect,
            project_id=trace_project_id,
            batch_limit=self._batch_limit,
        )
        if annotation_config_res.status is not PrimitiveStatus.EMPTY:
            return annotation_config_res

        trace_res = await drain_trace_scope_step(
            session,
            dialect=dialect,
            project_id=trace_project_id,
            batch_limit=self._batch_limit,
            rehome_shared_sessions=True,
        )
        if trace_res.status is not PrimitiveStatus.EMPTY:
            return trace_res

        if dialect is SupportedSQLDialect.POSTGRESQL:
            await session.execute(
                select(models.Project.id)
                .where(models.Project.id == trace_project_id)
                .with_for_update()
            )
            await session.execute(
                select(models.ProjectEvaluator.id)
                .where(models.ProjectEvaluator.id == binding_id)
                .with_for_update()
            )
        residual = bool(
            await session.scalar(
                select(
                    or_(
                        exists().where(models.EvalWorkUnit.project_evaluator_id == binding_id),
                        exists().where(models.EvalTraceWorkUnit.project_evaluator_id == binding_id),
                        exists().where(
                            models.EvalSessionWorkUnit.project_evaluator_id == binding_id
                        ),
                        exists().where(models.Trace.project_rowid == trace_project_id),
                        exists().where(models.ProjectSession.project_id == trace_project_id),
                    )
                )
            )
        )
        if residual:
            return PrimitiveResult(PrimitiveStatus.YIELD, 0)

        await session.execute(delete(models.CleanupTask).where(models.CleanupTask.id == task.id))
        await session.execute(
            delete(models.ProjectEvaluator).where(models.ProjectEvaluator.id == binding_id)
        )
        await session.execute(delete(models.Project).where(models.Project.id == trace_project_id))
        events_after_commit.append(SpanDeleteEvent((trace_project_id,)))
        events_after_commit.append(ProjectDeleteEvent((trace_project_id,)))
        return PrimitiveResult(PrimitiveStatus.EMPTY, 1)

    async def _step_dataset_evaluator_delete(
        self,
        session: AsyncSession,
        *,
        dialect: SupportedSQLDialect,
        task: models.DatasetEvaluatorCleanupTask,
        events_after_commit: list[DmlEvent],
    ) -> PrimitiveResult:
        binding_id = task.dataset_evaluator_id
        trace_project_id = await session.scalar(
            select(models.DatasetEvaluators.project_id).where(
                models.DatasetEvaluators.id == binding_id
            )
        )
        if trace_project_id is None:
            await session.execute(
                delete(models.CleanupTask).where(models.CleanupTask.id == task.id)
            )
            return PrimitiveResult(PrimitiveStatus.EMPTY, 0)

        dep_res = await drain_dataset_evaluator_dependents_step(
            session,
            dialect=dialect,
            dataset_evaluator_id=binding_id,
            batch_limit=self._batch_limit,
        )
        if dep_res.status is not PrimitiveStatus.EMPTY:
            return dep_res

        annotation_config_res = await drain_project_annotation_config_links_step(
            session,
            dialect=dialect,
            project_id=trace_project_id,
            batch_limit=self._batch_limit,
        )
        if annotation_config_res.status is not PrimitiveStatus.EMPTY:
            return annotation_config_res

        trace_res = await drain_trace_scope_step(
            session,
            dialect=dialect,
            project_id=trace_project_id,
            batch_limit=self._batch_limit,
            rehome_shared_sessions=True,
        )
        if trace_res.status is not PrimitiveStatus.EMPTY:
            return trace_res

        if dialect is SupportedSQLDialect.POSTGRESQL:
            await session.execute(
                select(models.Project.id)
                .where(models.Project.id == trace_project_id)
                .with_for_update()
            )
            await session.execute(
                select(models.DatasetEvaluators.id)
                .where(models.DatasetEvaluators.id == binding_id)
                .with_for_update()
            )
        residual = bool(
            await session.scalar(
                select(
                    or_(
                        exists().where(models.ExperimentEvalLog.dataset_evaluator_id == binding_id),
                        exists().where(
                            models.ExperimentDatasetEvaluator.dataset_evaluator_id == binding_id
                        ),
                        exists().where(models.Trace.project_rowid == trace_project_id),
                        exists().where(models.ProjectSession.project_id == trace_project_id),
                    )
                )
            )
        )
        if residual:
            return PrimitiveResult(PrimitiveStatus.YIELD, 0)

        await session.execute(delete(models.CleanupTask).where(models.CleanupTask.id == task.id))
        await session.execute(
            delete(models.DatasetEvaluators).where(models.DatasetEvaluators.id == binding_id)
        )
        await session.execute(delete(models.Project).where(models.Project.id == trace_project_id))
        events_after_commit.append(SpanDeleteEvent((trace_project_id,)))
        events_after_commit.append(ProjectDeleteEvent((trace_project_id,)))
        return PrimitiveResult(PrimitiveStatus.EMPTY, 1)

    async def step_or_next_delay(self) -> tuple[bool, Optional[float]]:
        """Claim and execute one due step, or return seconds until the earliest eligible task."""
        claimed, next_delay_seconds = await self._claim_next_or_delay()
        if claimed is None:
            return False, next_delay_seconds
        await self.execute_claimed_step(claimed)
        return True, None
