"""Bounded, transaction-neutral deletion primitives for background reclamation.

Each primitive limits directly modified rows to ``batch_limit`` inside a caller-owned
``AsyncSession``; residual cascades are separately bounded per dependent collection
without committing. A short or zero delete count is never assumed to prove emptiness when
``SKIP LOCKED`` or concurrent deletes can skip rows; each primitive verifies remaining scope
with an unskipped ``EXISTS`` check and distinguishes:
- ``PROGRESS``: deleted/cleared at least one row; schedule the next step immediately.
- ``YIELD``: zero rows modified while matching rows still exist (e.g. locked by an active
  writer); yield with a short retry delay instead of spinning or cascading.
- ``EMPTY``: zero matching rows remain in this collection.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    ColumnElement,
    and_,
    delete,
    exists,
    func,
    literal,
    select,
    text,
    update,
)
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.eval_work import queued_index_predicate
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.online_eval.work_tables import WORK_TABLES, WorkUnitModel

CLEANUP_BATCH_ROWS = 1_000

_WORK_UNIT_MODELS: tuple[WorkUnitModel, ...] = tuple(
    table.work_unit_model for table in WORK_TABLES.values()
)
_RESETTABLE_SESSION_EVAL_STATUSES: tuple[models.EvalWorkStatus, ...] = (
    "DONE",
    "FILTERED_OUT",
    "SAMPLED_OUT",
)


class PrimitiveStatus(str, Enum):
    PROGRESS = "PROGRESS"
    YIELD = "YIELD"
    EMPTY = "EMPTY"


@dataclass(frozen=True)
class PrimitiveResult:
    status: PrimitiveStatus
    affected_rows: int = 0


def _rowcount(result: object) -> int:
    count = getattr(result, "rowcount", 0)
    return int(count) if isinstance(count, int) and count > 0 else 0


async def _has_any(session: AsyncSession, condition: ColumnElement[bool]) -> bool:
    return bool(await session.scalar(select(exists().where(condition))))


def trace_scope_condition(
    project_id: int,
    *,
    max_trace_rowid: Optional[int] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> ColumnElement[bool]:
    """Predicate selecting traces belonging to a project deletion or bounded clear."""
    conditions: list[ColumnElement[bool]] = [models.Trace.project_rowid == project_id]
    if max_trace_rowid is not None:
        conditions.append(models.Trace.id <= max_trace_rowid)
    if start_time is not None:
        conditions.append(models.Trace.start_time >= start_time)
    if end_time is not None:
        conditions.append(models.Trace.start_time < end_time)
    return and_(*conditions)


async def _delete_by_ids(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    model: type[models.HasId],
    condition: ColumnElement[bool],
    batch_limit: int,
) -> PrimitiveResult:
    candidates = select(model.id).where(condition).limit(batch_limit)
    if dialect is SupportedSQLDialect.POSTGRESQL:
        candidates = candidates.with_for_update(skip_locked=True)
    ids = list(await session.scalars(candidates))
    if ids:
        ids.sort()
        deleted = _rowcount(await session.execute(delete(model).where(model.id.in_(ids))))
        if deleted > 0:
            return PrimitiveResult(PrimitiveStatus.PROGRESS, deleted)
    if await _has_any(session, condition):
        return PrimitiveResult(PrimitiveStatus.YIELD, 0)
    return PrimitiveResult(PrimitiveStatus.EMPTY, 0)


async def _drain_overflow_by_ids(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    model: type[models.HasId],
    condition: ColumnElement[bool],
    batch_limit: int,
) -> Optional[PrimitiveResult]:
    probe_stmt = select(literal(1)).where(condition).offset(batch_limit).limit(1)
    if (await session.scalar(probe_stmt)) is None:
        return None
    result = await _delete_by_ids(
        session,
        dialect=dialect,
        model=model,
        condition=condition,
        batch_limit=batch_limit,
    )
    if result.status is PrimitiveStatus.EMPTY:
        return None
    return result


async def drain_eval_work_units_step(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    project_evaluator_id: int,
    batch_limit: int = CLEANUP_BATCH_ROWS,
) -> PrimitiveResult:
    """Drain one bounded batch of queued work units first, then terminal ledger rows."""
    for queued_only in (True, False):
        for model in _WORK_UNIT_MODELS:
            condition: ColumnElement[bool] = model.project_evaluator_id == project_evaluator_id
            if queued_only:
                condition = and_(condition, text(queued_index_predicate()))
            res = await _delete_by_ids(
                session,
                dialect=dialect,
                model=model,
                condition=condition,
                batch_limit=batch_limit,
            )
            if res.status is not PrimitiveStatus.EMPTY:
                return res
    return PrimitiveResult(PrimitiveStatus.EMPTY, 0)


async def drain_dataset_evaluator_dependents_step(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    dataset_evaluator_id: int,
    batch_limit: int = CLEANUP_BATCH_ROWS,
) -> PrimitiveResult:
    """Drain root ``experiment_logs`` (cascading downward to ``experiment_eval_logs``) and
    ``experiment_dataset_evaluators`` links before removing a dataset-evaluator tombstone."""
    eval_log_table = models.ExperimentEvalLog.__table__
    eval_log_condition = eval_log_table.c.dataset_evaluator_id == dataset_evaluator_id
    if dialect is SupportedSQLDialect.POSTGRESQL:
        # LATERAL keeps the outer scan on ix_experiment_eval_logs_dataset_evaluator_id (avoiding a
        # Hash/Merge Join across all experiment_logs) while letting SKIP LOCKED advance past locked
        # rows before LIMIT batch_limit stops the scan.
        locked_eval_log = (
            select(models.ExperimentLog.id)
            .where(
                models.ExperimentLog.id == eval_log_table.c.id,
                models.ExperimentLog.category == "EVAL",
            )
            .with_for_update(skip_locked=True)
            .lateral("locked_eval_log")
        )
        log_ids_stmt = (
            select(locked_eval_log.c.id)
            .select_from(eval_log_table.join(locked_eval_log, literal(True)))
            .where(eval_log_condition)
            .limit(batch_limit)
        )
    else:
        log_ids_stmt = select(eval_log_table.c.id).where(eval_log_condition).limit(batch_limit)
    log_ids: list[int] = [int(log_id) for log_id in await session.scalars(log_ids_stmt)]
    if log_ids:
        log_ids.sort()
        deleted_logs = _rowcount(
            await session.execute(
                delete(models.ExperimentLog).where(
                    models.ExperimentLog.category == "EVAL",
                    models.ExperimentLog.id.in_(log_ids),
                )
            )
        )
        if deleted_logs > 0:
            return PrimitiveResult(PrimitiveStatus.PROGRESS, deleted_logs)
    if await _has_any(session, eval_log_condition):
        return PrimitiveResult(PrimitiveStatus.YIELD, 0)

    link_condition = models.ExperimentDatasetEvaluator.dataset_evaluator_id == dataset_evaluator_id
    experiment_ids_stmt = (
        select(models.ExperimentDatasetEvaluator.experiment_id)
        .where(link_condition)
        .limit(batch_limit)
    )
    if dialect is SupportedSQLDialect.POSTGRESQL:
        experiment_ids_stmt = experiment_ids_stmt.with_for_update(skip_locked=True)
    experiment_ids = list(await session.scalars(experiment_ids_stmt))
    if experiment_ids:
        experiment_ids.sort()
        deleted_links = _rowcount(
            await session.execute(
                delete(models.ExperimentDatasetEvaluator).where(
                    link_condition,
                    models.ExperimentDatasetEvaluator.experiment_id.in_(experiment_ids),
                )
            )
        )
        if deleted_links > 0:
            return PrimitiveResult(PrimitiveStatus.PROGRESS, deleted_links)
    if await _has_any(session, link_condition):
        return PrimitiveResult(PrimitiveStatus.YIELD, 0)

    return PrimitiveResult(PrimitiveStatus.EMPTY, 0)


async def _drain_span_children_batch(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    span_ids: list[int],
    batch_limit: int,
) -> Optional[PrimitiveResult]:
    """Ensure no selected span batch triggers an unbounded child cascade or SET NULL update."""
    # 1. Clear dataset_examples.span_rowid in bounded updates before deleting spans.
    example_cond = models.DatasetExample.span_rowid.in_(span_ids)
    example_ids_stmt = select(models.DatasetExample.id).where(example_cond).limit(batch_limit)
    if dialect is SupportedSQLDialect.POSTGRESQL:
        example_ids_stmt = example_ids_stmt.with_for_update(skip_locked=True)
    example_ids = list(await session.scalars(example_ids_stmt))
    if example_ids:
        example_ids.sort()
        cleared = _rowcount(
            await session.execute(
                update(models.DatasetExample)
                .where(models.DatasetExample.id.in_(example_ids))
                .values(span_rowid=None)
            )
        )
        if cleared > 0:
            return PrimitiveResult(PrimitiveStatus.PROGRESS, cleared)
    if await _has_any(session, example_cond):
        return PrimitiveResult(PrimitiveStatus.YIELD, 0)

    # 2. Drain potentially high-fanout child tables if their count across the selected spans
    # exceeds batch_limit; small child sets cascade directly with the span batch. SpanCostDetail
    # sits one level below SpanCost and is drained leaf-first before SpanCost or Span deletes.
    detail_condition = models.SpanCostDetail.span_cost_id.in_(
        select(models.SpanCost.id).where(models.SpanCost.span_rowid.in_(span_ids))
    )
    detail_result = await _drain_overflow_by_ids(
        session,
        dialect=dialect,
        model=models.SpanCostDetail,
        condition=detail_condition,
        batch_limit=batch_limit,
    )
    if detail_result is not None:
        return detail_result

    for child_model in (
        models.DocumentAnnotation,
        models.SpanAnnotation,
        models.SpanCost,
        models.EvalWorkUnit,
    ):
        child_result = await _drain_overflow_by_ids(
            session,
            dialect=dialect,
            model=child_model,
            condition=child_model.span_rowid.in_(span_ids),
            batch_limit=batch_limit,
        )
        if child_result is not None:
            return child_result
    return None


async def drain_traces_step(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    trace_cond: ColumnElement[bool],
    batch_limit: int = CLEANUP_BATCH_ROWS,
    reset_session_evaluations: bool = False,
) -> PrimitiveResult:
    """Drain a bounded trace window, yielding when its remaining rows are locked."""
    # Phases 1-2 work on a window of the oldest in-scope traces. Spans in the window are drained
    # first; once the window's traces are span-less they are deleted, so the next window starts at
    # the next-oldest traces and every step touches rows proportional to its own batch.
    # ix_traces_project_rowid_start_time is (project_rowid, start_time DESC), whose reverse B-tree
    # order on SQLite is (start_time ASC, id DESC).
    window_stmt = (
        select(models.Trace.id)
        .where(trace_cond)
        .order_by(models.Trace.start_time.asc(), models.Trace.id.desc())
        .limit(batch_limit)
    )
    if dialect is SupportedSQLDialect.POSTGRESQL:
        window_stmt = window_stmt.with_for_update(skip_locked=True)
    trace_ids = list(await session.scalars(window_stmt))
    if trace_ids:
        trace_ids.sort()
        span_candidates_stmt = (
            select(models.Span.id).where(models.Span.trace_rowid.in_(trace_ids)).limit(batch_limit)
        )
        if dialect is SupportedSQLDialect.POSTGRESQL:
            span_candidates_stmt = span_candidates_stmt.with_for_update(skip_locked=True)
        span_ids = list(await session.scalars(span_candidates_stmt))
        if span_ids:
            span_ids.sort()
            child_step = await _drain_span_children_batch(
                session,
                dialect=dialect,
                span_ids=span_ids,
                batch_limit=batch_limit,
            )
            if child_step is not None:
                return child_step
            deleted_spans = _rowcount(
                await session.execute(delete(models.Span).where(models.Span.id.in_(span_ids)))
            )
            if deleted_spans > 0:
                return PrimitiveResult(PrimitiveStatus.PROGRESS, deleted_spans)

        for child_model in (models.TraceAnnotation, models.EvalTraceWorkUnit):
            child_result = await _drain_overflow_by_ids(
                session,
                dialect=dialect,
                model=child_model,
                condition=child_model.trace_rowid.in_(trace_ids),
                batch_limit=batch_limit,
            )
            if child_result is not None:
                return child_result
        # Delete only traces that still have zero spans attached; a span locked by another
        # writer or attached by a concurrent insert keeps its trace.
        no_spans_attached = (
            ~select(literal(1)).where(models.Span.trace_rowid == models.Trace.id).exists()
        )
        ready_trace_cond = and_(
            models.Trace.id.in_(trace_ids),
            no_spans_attached,
        )
        reset_rows = 0
        if reset_session_evaluations:
            reset_result = await reset_session_evaluations_step(
                session,
                dialect=dialect,
                ready_trace_cond=ready_trace_cond,
                batch_limit=batch_limit,
            )
            if reset_result.status is PrimitiveStatus.YIELD:
                return reset_result
            if reset_result.status is PrimitiveStatus.PROGRESS:
                reset_rows = reset_result.affected_rows
                if reset_rows >= batch_limit or await _has_any(
                    session, _resettable_session_evaluations_condition(ready_trace_cond)
                ):
                    return reset_result
        deleted_traces = _rowcount(
            await session.execute(delete(models.Trace).where(ready_trace_cond))
        )
        if deleted_traces > 0:
            return PrimitiveResult(PrimitiveStatus.PROGRESS, deleted_traces)
        if reset_rows > 0:
            return PrimitiveResult(PrimitiveStatus.PROGRESS, reset_rows)
        return PrimitiveResult(PrimitiveStatus.YIELD, 0)

    if await _has_any(session, trace_cond):
        return PrimitiveResult(PrimitiveStatus.YIELD, 0)

    return PrimitiveResult(PrimitiveStatus.EMPTY, 0)


async def drain_trace_scope_step(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    project_id: int,
    max_trace_rowid: Optional[int] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    batch_limit: int = CLEANUP_BATCH_ROWS,
    rehome_shared_sessions: bool = False,
) -> PrimitiveResult:
    """Drain one bounded step of spans, traces, and eligible orphan sessions for a project scope.

    Traces are scanned in ascending ``start_time`` order so ``ix_traces_project_rowid_start_time``
    reads oldest in-scope rows first. Each step drains the spans of the oldest window of traces and
    deletes the window's span-less traces, so the window advances as rows are removed. A ``Trace``
    row is deleted only when zero ``Span`` rows remain attached to it, bounding any residual
    cascade. When ``rehome_shared_sessions`` is ``True``, sessions owned by ``project_id`` whose
    only remaining traces belong to other projects are reassigned before ``project_id`` is deleted.
    """
    trace_cond = trace_scope_condition(
        project_id,
        max_trace_rowid=max_trace_rowid,
        start_time=start_time,
        end_time=end_time,
    )

    trace_result = await drain_traces_step(
        session,
        dialect=dialect,
        trace_cond=trace_cond,
        batch_limit=batch_limit,
        reset_session_evaluations=max_trace_rowid is not None,
    )
    if trace_result.status is not PrimitiveStatus.EMPTY:
        return trace_result

    # Phase 3: Drain eligible orphan project_sessions (only sessions with zero traces anywhere).
    # If any pre-existing cross-project trace still points at a session in this project,
    # ~exists(Trace.project_session_rowid == ProjectSession.id) excludes that session so cleanup
    # never cascade-deletes another project's trace.
    orphan_session_cond = and_(
        models.ProjectSession.project_id == project_id,
        ~select(literal(1))
        .where(models.Trace.project_session_rowid == models.ProjectSession.id)
        .exists(),
    )
    session_candidates_stmt = (
        select(models.ProjectSession.id).where(orphan_session_cond).limit(batch_limit)
    )
    if dialect is SupportedSQLDialect.POSTGRESQL:
        session_candidates_stmt = session_candidates_stmt.with_for_update(skip_locked=True)
    session_ids = list(await session.scalars(session_candidates_stmt))
    if session_ids:
        session_ids.sort()
        for session_child_model in (models.ProjectSessionAnnotation, models.EvalSessionWorkUnit):
            session_child_col = (
                models.ProjectSessionAnnotation.project_session_id
                if session_child_model is models.ProjectSessionAnnotation
                else models.EvalSessionWorkUnit.project_session_rowid
            )
            child_result = await _drain_overflow_by_ids(
                session,
                dialect=dialect,
                model=session_child_model,
                condition=session_child_col.in_(session_ids),
                batch_limit=batch_limit,
            )
            if child_result is not None:
                return child_result
        still_orphan = (
            ~select(literal(1))
            .where(models.Trace.project_session_rowid == models.ProjectSession.id)
            .exists()
        )
        deleted_sessions = _rowcount(
            await session.execute(
                delete(models.ProjectSession).where(
                    models.ProjectSession.id.in_(session_ids),
                    still_orphan,
                )
            )
        )
        if deleted_sessions > 0:
            return PrimitiveResult(PrimitiveStatus.PROGRESS, deleted_sessions)
    if await _has_any(session, orphan_session_cond):
        return PrimitiveResult(PrimitiveStatus.YIELD, 0)

    if not rehome_shared_sessions:
        return PrimitiveResult(PrimitiveStatus.EMPTY, 0)

    # If a ProjectSession owned by `project_id` still has surviving traces in another
    # project (because `project_sessions.session_id` is globally unique across projects),
    # reassign its `project_id` to one of those surviving projects before deleting `project_id`
    # so the project FK CASCADE never deletes traces belonging to another project.
    surviving_other_project_subq = (
        select(models.Trace.project_rowid)
        .join(models.Project, models.Project.id == models.Trace.project_rowid)
        .where(
            models.Trace.project_session_rowid == models.ProjectSession.id,
            models.Trace.project_rowid != project_id,
            models.Project.deleted_at.is_(None),
        )
        .order_by(models.Trace.id.asc())
        .limit(1)
        .scalar_subquery()
    )
    fallback_other_project_subq = (
        select(models.Trace.project_rowid)
        .where(
            models.Trace.project_session_rowid == models.ProjectSession.id,
            models.Trace.project_rowid != project_id,
        )
        .order_by(models.Trace.id.asc())
        .limit(1)
        .scalar_subquery()
    )
    target_other_project = func.coalesce(
        surviving_other_project_subq,
        fallback_other_project_subq,
    )
    shared_session_cond = and_(
        models.ProjectSession.project_id == project_id,
        ~select(literal(1))
        .where(
            models.Trace.project_session_rowid == models.ProjectSession.id,
            models.Trace.project_rowid == project_id,
        )
        .exists(),
        select(literal(1))
        .where(
            models.Trace.project_session_rowid == models.ProjectSession.id,
            models.Trace.project_rowid != project_id,
        )
        .exists(),
    )
    shared_session_ids_stmt = (
        select(models.ProjectSession.id).where(shared_session_cond).limit(batch_limit)
    )
    if dialect is SupportedSQLDialect.POSTGRESQL:
        shared_session_ids_stmt = shared_session_ids_stmt.with_for_update(skip_locked=True)
    shared_session_ids = list(await session.scalars(shared_session_ids_stmt))
    if shared_session_ids:
        shared_session_ids.sort()
        reassigned = _rowcount(
            await session.execute(
                update(models.ProjectSession)
                .where(
                    models.ProjectSession.id.in_(shared_session_ids),
                    target_other_project.is_not(None),
                )
                .values(project_id=target_other_project)
            )
        )
        if reassigned > 0:
            return PrimitiveResult(PrimitiveStatus.PROGRESS, reassigned)
    if await _has_any(session, shared_session_cond):
        return PrimitiveResult(PrimitiveStatus.YIELD, 0)

    return PrimitiveResult(PrimitiveStatus.EMPTY, 0)


async def clear_project_historical_references_step(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    project_id: int,
    batch_limit: int = CLEANUP_BATCH_ROWS,
) -> PrimitiveResult:
    """Clear ``experiments.project_id`` and ``agent_sessions.project_id`` in bounded batches
    before physically deleting ``projects(id = project_id)``."""
    for model in (models.Experiment, models.AgentSession):
        cond = model.project_id == project_id
        ids_stmt = select(model.id).where(cond).limit(batch_limit)
        if dialect is SupportedSQLDialect.POSTGRESQL:
            ids_stmt = ids_stmt.with_for_update(skip_locked=True)
        ids = list(await session.scalars(ids_stmt))
        if ids:
            ids.sort()
            cleared = _rowcount(
                await session.execute(
                    update(model).where(model.id.in_(ids)).values(project_id=None)
                )
            )
            if cleared > 0:
                return PrimitiveResult(PrimitiveStatus.PROGRESS, cleared)
        if await _has_any(session, cond):
            return PrimitiveResult(PrimitiveStatus.YIELD, 0)

    overflow_result = await _drain_overflow_by_ids(
        session,
        dialect=dialect,
        model=models.ProjectAnnotationConfig,
        condition=models.ProjectAnnotationConfig.project_id == project_id,
        batch_limit=batch_limit,
    )
    if overflow_result is not None:
        return overflow_result
    return PrimitiveResult(PrimitiveStatus.EMPTY, 0)


def _resettable_session_evaluations_condition(
    ready_trace_cond: ColumnElement[bool],
) -> ColumnElement[bool]:
    affected_sessions = select(models.Trace.project_session_rowid).where(
        ready_trace_cond,
        models.Trace.project_session_rowid.is_not(None),
    )
    return and_(
        models.EvalSessionWorkUnit.project_session_rowid.in_(affected_sessions),
        models.EvalSessionWorkUnit.status.in_(_RESETTABLE_SESSION_EVAL_STATUSES),
    )


async def reset_session_evaluations_step(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    ready_trace_cond: ColumnElement[bool],
    batch_limit: int,
) -> PrimitiveResult:
    """Reset final session evaluation decisions for span-drained traces about to be cleared."""
    condition = _resettable_session_evaluations_condition(ready_trace_cond)
    candidates = select(models.EvalSessionWorkUnit.id).where(condition).limit(batch_limit)
    if dialect is SupportedSQLDialect.POSTGRESQL:
        candidates = candidates.with_for_update(skip_locked=True)
    ids = list(await session.scalars(candidates))
    if ids:
        ids.sort()
        count = _rowcount(
            await session.execute(
                update(models.EvalSessionWorkUnit)
                .where(
                    models.EvalSessionWorkUnit.id.in_(ids),
                    models.EvalSessionWorkUnit.status.in_(_RESETTABLE_SESSION_EVAL_STATUSES),
                )
                .values(status="DROPPED")
            )
        )
        if count > 0:
            return PrimitiveResult(PrimitiveStatus.PROGRESS, count)
    if await _has_any(session, condition):
        return PrimitiveResult(PrimitiveStatus.YIELD, 0)
    return PrimitiveResult(PrimitiveStatus.EMPTY, 0)
