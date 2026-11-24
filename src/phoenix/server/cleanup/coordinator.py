"""Coordinator that drains tombstoned projects and evaluator bindings in bounded steps.

The tombstones (``deleted_at IS NOT NULL`` on ``projects``, ``project_evaluators``, and
``dataset_evaluators``) are the work list. Each step is one transaction that takes a
transaction-scoped advisory lock on PostgreSQL (SQLite serializes writers), picks the oldest
target that is not backing off, drains one bounded batch of it, and deletes the target rows
once nothing is left. ``cleanup_failures`` holds retry state only, for targets that yielded
or failed; it is neither a queue nor a lease.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal, Optional

from sqlalchemy import (
    Select,
    and_,
    delete,
    exists,
    func,
    literal,
    or_,
    select,
    text,
    union_all,
    update,
)
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, is_lock_contention
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
_CLEANUP_STEP_ADVISORY_LOCK_ID = 0x636C6E705F717565  # "clnp_que"

YIELD_DELAY_SECONDS = 0.25
ERROR_RETRY_DELAY_SECONDS = 15.0
MAX_ERROR_RETRY_DELAY_SECONDS = 3600.0
STATEMENT_TIMEOUT_MS = 60_000
LOCK_TIMEOUT_MS = 5_000


@dataclass(frozen=True)
class CleanupTarget:
    kind: models.CleanupTargetKind
    id: int


StepOutcome: TypeAlias = Literal["progress", "yield", "completed", "error", "busy", "idle"]


@dataclass(frozen=True)
class StepExecutionResult:
    outcome: StepOutcome
    affected_rows: int = 0
    next_delay_seconds: Optional[float] = None


def _eligible_targets() -> Select[tuple[str, int, datetime]]:
    """Every tombstoned row that cleanup may work on now, as ``(kind, id, deleted_at)``.

    A project is eligible only once no binding references it as owner or trace project; a
    binding's trace project is tombstoned with the binding and removed by the binding's own
    final step.
    """
    project = models.Project
    project_evaluator = models.ProjectEvaluator
    dataset_evaluator = models.DatasetEvaluators
    return union_all(
        select(
            literal("PROJECT").label("kind"),
            project.id.label("id"),
            project.deleted_at.label("deleted_at"),
        ).where(
            project.deleted_at.is_not(None),
            ~exists().where(
                or_(
                    project_evaluator.project_id == project.id,
                    project_evaluator.trace_project_id == project.id,
                )
            ),
            ~exists().where(dataset_evaluator.project_id == project.id),
        ),
        select(
            literal("PROJECT_EVALUATOR"),
            project_evaluator.id,
            project_evaluator.deleted_at,
        ).where(project_evaluator.deleted_at.is_not(None)),
        select(
            literal("DATASET_EVALUATOR"),
            dataset_evaluator.id,
            dataset_evaluator.deleted_at,
        ).where(dataset_evaluator.deleted_at.is_not(None)),
    )  # type: ignore[return-value]


class CleanupCoordinator:
    """Selects the next tombstoned target and runs one bounded cleanup step on it."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        event_queue: Optional[CanPutItem[DmlEvent]] = None,
        batch_limit: int = CLEANUP_BATCH_ROWS,
        yield_delay_seconds: float = YIELD_DELAY_SECONDS,
        error_retry_delay_seconds: float = ERROR_RETRY_DELAY_SECONDS,
    ) -> None:
        self._db = db
        self._event_queue = event_queue
        self._batch_limit = batch_limit
        self._yield_delay_seconds = yield_delay_seconds
        self._error_retry_delay_seconds = error_retry_delay_seconds

    def _compute_error_retry_delay_seconds(self, *, num_prior_failures: int) -> float:
        return float(
            min(
                self._error_retry_delay_seconds * 2 ** min(num_prior_failures, 20),
                max(self._error_retry_delay_seconds, MAX_ERROR_RETRY_DELAY_SECONDS),
            )
        )

    async def _acquire_step_lock(self, session: AsyncSession) -> bool:
        """Make this transaction the only stepping one; ``False`` means another replica is."""
        dialect = SupportedSQLDialect(session.get_bind().dialect.name)
        if dialect is SupportedSQLDialect.POSTGRESQL:
            await session.execute(text(f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}"))
            await session.execute(text(f"SET LOCAL lock_timeout = {LOCK_TIMEOUT_MS}"))
            return bool(
                await session.scalar(
                    select(func.pg_try_advisory_xact_lock(_CLEANUP_STEP_ADVISORY_LOCK_ID))
                )
            )
        # A conditional write that matches nothing still takes SQLite's writer lock, so the
        # reads below never start from a snapshot that a later write would have to upgrade.
        await session.execute(
            update(models.CleanupFailure)
            .where(models.CleanupFailure.target_id == -1)
            .values(failure_count=0)
        )
        return True

    async def _select_next_target(
        self, session: AsyncSession, *, now: datetime
    ) -> tuple[Optional[CleanupTarget], Optional[float]]:
        """The oldest target not backing off, or else the delay until the earliest retry."""
        eligible = _eligible_targets().subquery("eligible")
        failure = models.CleanupFailure
        backing_off_join = and_(
            failure.target_kind == eligible.c.kind,
            failure.target_id == eligible.c.id,
        )
        row = (
            await session.execute(
                select(eligible.c.kind, eligible.c.id)
                .outerjoin(failure, backing_off_join)
                .where(or_(failure.retry_at.is_(None), failure.retry_at <= now))
                .order_by(eligible.c.deleted_at.asc(), eligible.c.kind.asc(), eligible.c.id.asc())
                .limit(1)
            )
        ).first()
        if row is not None:
            return CleanupTarget(kind=row.kind, id=int(row.id)), None
        next_retry_at = await session.scalar(
            select(func.min(failure.retry_at))
            .select_from(eligible)
            .join(failure, backing_off_join)
            .where(failure.retry_at > now)
        )
        if next_retry_at is None:
            return None, None
        return None, max(0.0, (next_retry_at - now).total_seconds())

    async def _delete_failure(
        self, session: AsyncSession, *, kind: models.CleanupTargetKind, target_id: int
    ) -> None:
        await session.execute(
            delete(models.CleanupFailure).where(
                models.CleanupFailure.target_kind == kind,
                models.CleanupFailure.target_id == target_id,
            )
        )

    async def _record_retry(
        self,
        session: AsyncSession,
        *,
        target: CleanupTarget,
        retry_at: datetime,
        failure_count: Optional[int],
    ) -> None:
        """Back ``target`` off until ``retry_at``; ``None`` keeps the stored failure count."""
        values = {
            "target_kind": target.kind,
            "target_id": target.id,
            "failure_count": failure_count or 0,
            "retry_at": retry_at,
        }
        update_columns: dict[str, object] = {"retry_at": retry_at}
        if failure_count is not None:
            update_columns["failure_count"] = failure_count
        if self._db.dialect is SupportedSQLDialect.POSTGRESQL:
            statement = insert_postgresql(models.CleanupFailure).values(values)
            await session.execute(
                statement.on_conflict_do_update(
                    index_elements=["target_kind", "target_id"], set_=update_columns
                )
            )
        else:
            sqlite_statement = insert_sqlite(models.CleanupFailure).values(values)
            await session.execute(
                sqlite_statement.on_conflict_do_update(
                    index_elements=["target_kind", "target_id"], set_=update_columns
                )
            )

    async def _record_short_retry(self, target: CleanupTarget) -> None:
        async with self._db() as session:
            now = await current_database_time(session, self._db.dialect)
            await self._record_retry(
                session,
                target=target,
                retry_at=now + timedelta(seconds=self._yield_delay_seconds),
                failure_count=None,
            )

    async def _record_failure(self, target: CleanupTarget) -> None:
        """Back a failed target off, doubling the delay per consecutive failure."""
        try:
            async with self._db() as session:
                now = await current_database_time(session, self._db.dialect)
                num_prior_failures = (
                    await session.scalar(
                        select(models.CleanupFailure.failure_count).where(
                            models.CleanupFailure.target_kind == target.kind,
                            models.CleanupFailure.target_id == target.id,
                        )
                    )
                    or 0
                )
                retry_delay_seconds = self._compute_error_retry_delay_seconds(
                    num_prior_failures=int(num_prior_failures)
                )
                await self._record_retry(
                    session,
                    target=target,
                    retry_at=now + timedelta(seconds=retry_delay_seconds),
                    failure_count=int(num_prior_failures) + 1,
                )
        except SQLAlchemyError:
            logger.exception(
                "Failed to record retry delay for cleanup target %s %s", target.kind, target.id
            )

    async def step(self) -> StepExecutionResult:
        """Run one bounded step on the oldest eligible target in a single transaction."""
        dialect = self._db.dialect
        events_after_commit: list[DmlEvent] = []
        target: Optional[CleanupTarget] = None
        try:
            async with self._db() as session:
                if not await self._acquire_step_lock(session):
                    return StepExecutionResult("busy")
                now = await current_database_time(session, dialect)
                target, next_delay_seconds = await self._select_next_target(session, now=now)
                if target is None:
                    return StepExecutionResult("idle", next_delay_seconds=next_delay_seconds)
                step_result = await self._run_domain_step(
                    session,
                    target=target,
                    events_after_commit=events_after_commit,
                )
                if step_result.status is PrimitiveStatus.PROGRESS:
                    await self._delete_failure(session, kind=target.kind, target_id=target.id)
                    outcome = StepExecutionResult("progress", step_result.affected_rows)
                elif step_result.status is PrimitiveStatus.YIELD:
                    now = await current_database_time(session, dialect)
                    await self._record_retry(
                        session,
                        target=target,
                        retry_at=now + timedelta(seconds=self._yield_delay_seconds),
                        failure_count=None,
                    )
                    outcome = StepExecutionResult("yield", 0)
                elif step_result.status is PrimitiveStatus.EMPTY:
                    outcome = StepExecutionResult("completed", step_result.affected_rows)
                else:
                    assert_never(step_result.status)
        except SQLAlchemyError as exc:
            if target is None:
                raise
            if is_lock_contention(exc):
                # A writer holds or deadlocked on the rows this step needs; retry shortly
                # without counting a failure.
                await self._record_short_retry(target)
                return StepExecutionResult("yield", 0)
            logger.exception("Cleanup of %s %s failed; scheduling retry", target.kind, target.id)
            await self._record_failure(target)
            return StepExecutionResult("error", 0)
        if self._event_queue is not None:
            for event in events_after_commit:
                self._event_queue.put(event)
        return outcome

    async def _run_domain_step(
        self,
        session: AsyncSession,
        *,
        target: CleanupTarget,
        events_after_commit: list[DmlEvent],
    ) -> PrimitiveResult:
        if target.kind == "PROJECT":
            return await self._step_project_delete(
                session,
                project_id=target.id,
                events_after_commit=events_after_commit,
            )
        if target.kind == "PROJECT_EVALUATOR":
            return await self._step_project_evaluator_delete(
                session,
                binding_id=target.id,
                events_after_commit=events_after_commit,
            )
        if target.kind == "DATASET_EVALUATOR":
            return await self._step_dataset_evaluator_delete(
                session,
                binding_id=target.id,
                events_after_commit=events_after_commit,
            )
        assert_never(target.kind)

    async def _step_project_delete(
        self,
        session: AsyncSession,
        *,
        project_id: int,
        events_after_commit: list[DmlEvent],
    ) -> PrimitiveResult:
        # Recheck fixed ordering invariants before draining/finalizing.
        dialect = SupportedSQLDialect(session.get_bind().dialect.name)
        has_bindings = bool(
            await session.scalar(
                select(exists().where(models.ProjectEvaluator.project_id == project_id))
            )
        )
        if has_bindings:
            return PrimitiveResult(PrimitiveStatus.YIELD, 0)

        annotation_config_res = await drain_project_annotation_config_links_step(
            session,
            project_id=project_id,
            batch_limit=self._batch_limit,
        )
        if annotation_config_res.status is not PrimitiveStatus.EMPTY:
            return annotation_config_res

        trace_res = await drain_trace_scope_step(
            session,
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

        await self._delete_failure(session, kind="PROJECT", target_id=project_id)
        await session.execute(delete(models.Project).where(models.Project.id == project_id))
        events_after_commit.append(SpanDeleteEvent((project_id,)))
        events_after_commit.append(ProjectDeleteEvent((project_id,)))
        return PrimitiveResult(PrimitiveStatus.EMPTY, 1)

    async def _step_project_evaluator_delete(
        self,
        session: AsyncSession,
        *,
        binding_id: int,
        events_after_commit: list[DmlEvent],
    ) -> PrimitiveResult:
        dialect = SupportedSQLDialect(session.get_bind().dialect.name)
        trace_project_id = await session.scalar(
            select(models.ProjectEvaluator.trace_project_id).where(
                models.ProjectEvaluator.id == binding_id
            )
        )
        if trace_project_id is None:
            return PrimitiveResult(PrimitiveStatus.EMPTY, 0)

        work_res = await drain_eval_work_units_step(
            session,
            project_evaluator_id=binding_id,
            batch_limit=self._batch_limit,
        )
        if work_res.status is not PrimitiveStatus.EMPTY:
            return work_res

        annotation_config_res = await drain_project_annotation_config_links_step(
            session,
            project_id=trace_project_id,
            batch_limit=self._batch_limit,
        )
        if annotation_config_res.status is not PrimitiveStatus.EMPTY:
            return annotation_config_res

        trace_res = await drain_trace_scope_step(
            session,
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

        await self._delete_failure(session, kind="PROJECT_EVALUATOR", target_id=binding_id)
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
        binding_id: int,
        events_after_commit: list[DmlEvent],
    ) -> PrimitiveResult:
        dialect = SupportedSQLDialect(session.get_bind().dialect.name)
        trace_project_id = await session.scalar(
            select(models.DatasetEvaluators.project_id).where(
                models.DatasetEvaluators.id == binding_id
            )
        )
        if trace_project_id is None:
            return PrimitiveResult(PrimitiveStatus.EMPTY, 0)

        dep_res = await drain_dataset_evaluator_dependents_step(
            session,
            dataset_evaluator_id=binding_id,
            batch_limit=self._batch_limit,
        )
        if dep_res.status is not PrimitiveStatus.EMPTY:
            return dep_res

        annotation_config_res = await drain_project_annotation_config_links_step(
            session,
            project_id=trace_project_id,
            batch_limit=self._batch_limit,
        )
        if annotation_config_res.status is not PrimitiveStatus.EMPTY:
            return annotation_config_res

        trace_res = await drain_trace_scope_step(
            session,
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

        await self._delete_failure(session, kind="DATASET_EVALUATOR", target_id=binding_id)
        await session.execute(
            delete(models.DatasetEvaluators).where(models.DatasetEvaluators.id == binding_id)
        )
        await session.execute(delete(models.Project).where(models.Project.id == trace_project_id))
        events_after_commit.append(SpanDeleteEvent((trace_project_id,)))
        events_after_commit.append(ProjectDeleteEvent((trace_project_id,)))
        return PrimitiveResult(PrimitiveStatus.EMPTY, 1)

    async def step_or_next_delay(self) -> tuple[bool, Optional[float]]:
        """Run one step, or return seconds until the earliest backed-off target retries."""
        result = await self.step()
        if result.outcome in ("busy", "idle"):
            return False, result.next_delay_seconds
        return True, None
