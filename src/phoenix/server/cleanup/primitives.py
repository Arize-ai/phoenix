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

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy import (
    ColumnElement,
    Select,
    and_,
    delete,
    exists,
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
STATEMENT_TIMEOUT_MS = 60_000
LOCK_TIMEOUT_MS = 5_000

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


async def set_local_timeouts(session: AsyncSession) -> None:
    """Bound this PostgreSQL transaction's statements and lock waits."""
    await session.execute(text(f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}"))
    await session.execute(text(f"SET LOCAL lock_timeout = {LOCK_TIMEOUT_MS}"))


def _rowcount(result: object) -> int:
    count = getattr(result, "rowcount", 0)
    return int(count) if isinstance(count, int) and count > 0 else 0


async def _has_any(session: AsyncSession, condition: ColumnElement[bool]) -> bool:
    return bool(await session.scalar(select(exists().where(condition))))


def trace_scope_condition(
    project_id: int,
    *,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> ColumnElement[bool]:
    """Predicate selecting traces belonging to a project deletion or bounded clear."""
    conditions: list[ColumnElement[bool]] = [models.Trace.project_rowid == project_id]
    if start_time is not None:
        conditions.append(models.Trace.start_time >= start_time)
    if end_time is not None:
        conditions.append(models.Trace.start_time < end_time)
    return and_(*conditions)


async def _claim_and_mutate(
    session: AsyncSession,
    *,
    candidates: Select[Any],
    condition: ColumnElement[bool],
    mutate: Callable[[list[int]], Awaitable[object]],
    lock_candidates: bool = True,
) -> PrimitiveResult:
    """Claim a bounded batch of candidate ids and mutate it in ascending id order.

    Returns ``PROGRESS`` when rows changed, ``YIELD`` when none changed although rows matching
    ``condition`` remain (for example, locked by another writer), and ``EMPTY`` otherwise.
    """
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)
    if lock_candidates and dialect is SupportedSQLDialect.POSTGRESQL:
        candidates = candidates.with_for_update(skip_locked=True)
    ids = sorted(await session.scalars(candidates))
    if ids:
        changed = _rowcount(await mutate(ids))
        if changed > 0:
            return PrimitiveResult(PrimitiveStatus.PROGRESS, changed)
    if await _has_any(session, condition):
        return PrimitiveResult(PrimitiveStatus.YIELD, 0)
    return PrimitiveResult(PrimitiveStatus.EMPTY, 0)


async def _delete_by_ids(
    session: AsyncSession,
    *,
    model: type[models.HasId],
    condition: ColumnElement[bool],
    batch_limit: int,
) -> PrimitiveResult:
    return await _claim_and_mutate(
        session,
        candidates=select(model.id).where(condition).limit(batch_limit),
        condition=condition,
        mutate=lambda ids: session.execute(delete(model).where(model.id.in_(ids))),
    )


async def _drain_overflow_by_ids(
    session: AsyncSession,
    *,
    model: type[models.HasId],
    condition: ColumnElement[bool],
    batch_limit: int,
) -> Optional[PrimitiveResult]:
    probe_stmt = select(literal(1)).where(condition).offset(batch_limit).limit(1)
    if (await session.scalar(probe_stmt)) is None:
        return None
    result = await _delete_by_ids(
        session,
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
    project_evaluator_id: int,
    batch_limit: int = CLEANUP_BATCH_ROWS,
) -> PrimitiveResult:
    """Drain one bounded batch of queued work units first, then terminal ledger rows."""
    for queued_only in (True, False):
        for model in _WORK_UNIT_MODELS:
            condition: ColumnElement[bool] = model.project_evaluator_id == project_evaluator_id
            if queued_only:
                condition = and_(condition, text(queued_index_predicate()))
            delete_result = await _delete_by_ids(
                session,
                model=model,
                condition=condition,
                batch_limit=batch_limit,
            )
            if delete_result.status is not PrimitiveStatus.EMPTY:
                return delete_result
    return PrimitiveResult(PrimitiveStatus.EMPTY, 0)


async def drain_dataset_evaluator_dependents_step(
    session: AsyncSession,
    *,
    dataset_evaluator_id: int,
    batch_limit: int = CLEANUP_BATCH_ROWS,
) -> PrimitiveResult:
    """Drain root ``experiment_logs`` (cascading downward to ``experiment_eval_logs``) and
    ``experiment_dataset_evaluators`` links before removing a dataset-evaluator tombstone."""
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)
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
    logs_result = await _claim_and_mutate(
        session,
        candidates=log_ids_stmt,
        condition=eval_log_condition,
        mutate=lambda log_ids: session.execute(
            delete(models.ExperimentLog).where(
                models.ExperimentLog.category == "EVAL",
                models.ExperimentLog.id.in_(log_ids),
            )
        ),
        lock_candidates=False,
    )
    if logs_result.status is not PrimitiveStatus.EMPTY:
        return logs_result

    link_condition = models.ExperimentDatasetEvaluator.dataset_evaluator_id == dataset_evaluator_id
    return await _claim_and_mutate(
        session,
        candidates=select(models.ExperimentDatasetEvaluator.experiment_id)
        .where(link_condition)
        .limit(batch_limit),
        condition=link_condition,
        mutate=lambda experiment_ids: session.execute(
            delete(models.ExperimentDatasetEvaluator).where(
                link_condition,
                models.ExperimentDatasetEvaluator.experiment_id.in_(experiment_ids),
            )
        ),
    )


async def _drain_span_children_batch(
    session: AsyncSession,
    *,
    span_ids: list[int],
    batch_limit: int,
) -> Optional[PrimitiveResult]:
    """Ensure no selected span batch triggers an unbounded child cascade or SET NULL update."""
    # 1. Clear dataset_examples.span_rowid in bounded updates before deleting spans.
    example_cond = models.DatasetExample.span_rowid.in_(span_ids)
    example_result = await _claim_and_mutate(
        session,
        candidates=select(models.DatasetExample.id).where(example_cond).limit(batch_limit),
        condition=example_cond,
        mutate=lambda example_ids: session.execute(
            update(models.DatasetExample)
            .where(models.DatasetExample.id.in_(example_ids))
            .values(span_rowid=None)
        ),
    )
    if example_result.status is not PrimitiveStatus.EMPTY:
        return example_result

    # 2. Drain potentially high-fanout child tables if their count across the selected spans
    # exceeds batch_limit; small child sets cascade directly with the span batch. SpanCostDetail
    # sits one level below SpanCost and is drained leaf-first before SpanCost or Span deletes.
    detail_condition = models.SpanCostDetail.span_cost_id.in_(
        select(models.SpanCost.id).where(models.SpanCost.span_rowid.in_(span_ids))
    )
    detail_result = await _drain_overflow_by_ids(
        session,
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
    trace_cond: ColumnElement[bool],
    batch_limit: int = CLEANUP_BATCH_ROWS,
    reset_session_evaluations: bool = False,
) -> PrimitiveResult:
    """Drain a bounded trace window, yielding when its remaining rows are locked."""
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)
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
    project_id: int,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    batch_limit: int = CLEANUP_BATCH_ROWS,
    reset_session_evaluations: bool = False,
) -> PrimitiveResult:
    """Drain one bounded step of spans, traces, and eligible orphan sessions for a project scope.

    Traces are scanned in ascending ``start_time`` order so ``ix_traces_project_rowid_start_time``
    reads oldest in-scope rows first. Each step drains the spans of the oldest window of traces and
    deletes the window's span-less traces, so the window advances as rows are removed. A ``Trace``
    row is deleted only when zero ``Span`` rows remain attached to it, bounding any residual
    cascade. Sessions owned by ``project_id`` that other projects' traces still reference are left
    in place, so the caller's project delete cascades through them.
    """
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)
    trace_cond = trace_scope_condition(
        project_id,
        start_time=start_time,
        end_time=end_time,
    )

    trace_result = await drain_traces_step(
        session,
        trace_cond=trace_cond,
        batch_limit=batch_limit,
        reset_session_evaluations=reset_session_evaluations,
    )
    if trace_result.status is not PrimitiveStatus.EMPTY:
        return trace_result

    # Phase 3: Drain orphan project_sessions (zero traces anywhere). A session that another
    # project's trace still references is excluded here and not waited on.
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

    return PrimitiveResult(PrimitiveStatus.EMPTY, 0)


async def drain_project_annotation_config_links_step(
    session: AsyncSession,
    *,
    project_id: int,
    batch_limit: int = CLEANUP_BATCH_ROWS,
) -> PrimitiveResult:
    """Delete ``project_annotation_configs`` links in bounded batches before physically
    deleting ``projects(id = project_id)``."""
    overflow_result = await _drain_overflow_by_ids(
        session,
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
    ready_trace_cond: ColumnElement[bool],
    batch_limit: int,
) -> PrimitiveResult:
    """Reset final session evaluation decisions for span-drained traces about to be cleared."""
    condition = _resettable_session_evaluations_condition(ready_trace_cond)
    return await _claim_and_mutate(
        session,
        candidates=select(models.EvalSessionWorkUnit.id).where(condition).limit(batch_limit),
        condition=condition,
        mutate=lambda ids: session.execute(
            update(models.EvalSessionWorkUnit)
            .where(
                models.EvalSessionWorkUnit.id.in_(ids),
                models.EvalSessionWorkUnit.status.in_(_RESETTABLE_SESSION_EVAL_STATUSES),
            )
            .values(status="DROPPED")
        ),
    )
