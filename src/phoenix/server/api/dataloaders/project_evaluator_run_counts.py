from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any, Iterable, Optional, Union

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.eval_work import FAILED_EVAL_WORK_STATUSES, LIVE_EVAL_WORK_STATUSES
from phoenix.server.types import DbSessionFactory

ProjectEvaluatorId: TypeAlias = int
Interval: TypeAlias = tuple[Optional[datetime], Optional[datetime]]
Key: TypeAlias = tuple[ProjectEvaluatorId, Optional[datetime], Optional[datetime]]

_WorkUnitModel: TypeAlias = Union[
    type[models.EvalWorkUnit],
    type[models.EvalSessionWorkUnit],
    type[models.EvalTraceWorkUnit],
]
_WORK_UNIT_MODELS: tuple[_WorkUnitModel, ...] = (
    models.EvalWorkUnit,
    models.EvalSessionWorkUnit,
    models.EvalTraceWorkUnit,
)

_QUEUED = "QUEUED"
_EVALUATED = "EVALUATED"
_FAILED = "FAILED"
_DROPPED = "DROPPED"


@dataclass(frozen=True)
class ProjectEvaluatorRunCounts:
    """How much evaluation work a project evaluator has produced, and when.

    Counts cover every evaluation target and reach back only as far as the online-eval
    retention window, after which completed work is reaped. Queued bounds refer to
    the start time of the span, trace, or session waiting to be evaluated.
    """

    queued: int = 0
    evaluated: int = 0
    failed: int = 0
    dropped: int = 0
    last_evaluated_at: Optional[datetime] = None
    last_failed_at: Optional[datetime] = None
    last_error: Optional[str] = None
    oldest_queued_at: Optional[datetime] = None
    newest_queued_at: Optional[datetime] = None


class ProjectEvaluatorRunCountsDataLoader(DataLoader[Key, ProjectEvaluatorRunCounts]):
    """Run counts for work that last changed within a time range.

    Keys are ``(project_evaluator_id, start, end)``; the range is start-inclusive and
    end-exclusive, an open bound is unbounded on that side, and ``(id, None, None)``
    counts everything retained. Work is placed in time by when it last changed, so an
    evaluation counts by when it finished or was given up on; within a bounded range
    the queued count only means "touched in range" and is best left unread.

    Every range in a batch is counted in one pass over the evaluators' work: each is a
    conditional aggregate over the same rows, so the all-time status and the in-range
    failure rate the evaluators table shows side by side cost a single scan.
    """

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[ProjectEvaluatorRunCounts]:
        keys = list(keys)
        project_evaluator_ids = sorted(
            {project_evaluator_id for project_evaluator_id, _, _ in keys}
        )
        intervals = list(dict.fromkeys((start, end) for _, start, end in keys))
        async with self._db.read() as session:
            result = await _load_run_counts(session, project_evaluator_ids, intervals)
            unbounded_ids = [
                project_evaluator_id
                for project_evaluator_id, start, end in keys
                if start is None
                and end is None
                and result.get(
                    (project_evaluator_id, None, None), ProjectEvaluatorRunCounts()
                ).queued
            ]
            if unbounded_ids:
                bounds = await _load_queue_bounds(session, sorted(set(unbounded_ids)))
                for project_evaluator_id, (oldest, newest) in bounds.items():
                    key = (project_evaluator_id, None, None)
                    result[key] = replace(
                        result[key], oldest_queued_at=oldest, newest_queued_at=newest
                    )
            for interval in intervals:
                last_errors = await _load_last_errors(session, project_evaluator_ids, interval)
                for project_evaluator_id, error in last_errors.items():
                    key = (project_evaluator_id, *interval)
                    counts = result.get(key, ProjectEvaluatorRunCounts())
                    result[key] = replace(counts, last_error=error)
        empty = ProjectEvaluatorRunCounts()
        return [result.get(key, empty) for key in keys]


async def _load_queue_bounds(
    session: AsyncSession, project_evaluator_ids: list[ProjectEvaluatorId]
) -> dict[ProjectEvaluatorId, tuple[datetime, datetime]]:
    """Find the start-time window of live work across span, trace, and session targets."""
    targets = (
        (models.EvalWorkUnit, models.Span, models.EvalWorkUnit.span_rowid),
        (models.EvalTraceWorkUnit, models.Trace, models.EvalTraceWorkUnit.trace_rowid),
        (
            models.EvalSessionWorkUnit,
            models.ProjectSession,
            models.EvalSessionWorkUnit.project_session_rowid,
        ),
    )
    statements = [
        sa.select(
            work_unit.project_evaluator_id,
            sa.func.min(target.start_time).label("oldest"),
            sa.func.max(target.start_time).label("newest"),
        )
        .join(target, target.id == target_id)
        .where(
            work_unit.project_evaluator_id.in_(project_evaluator_ids),
            work_unit.status.in_(LIVE_EVAL_WORK_STATUSES),
        )
        .group_by(work_unit.project_evaluator_id)
        for work_unit, target, target_id in targets
    ]
    bounds: dict[ProjectEvaluatorId, tuple[datetime, datetime]] = {}
    async for project_evaluator_id, oldest, newest in await session.stream(
        sa.union_all(*statements)
    ):
        if project_evaluator_id in bounds:
            previous_oldest, previous_newest = bounds[project_evaluator_id]
            oldest, newest = min(oldest, previous_oldest), max(newest, previous_newest)
        bounds[project_evaluator_id] = (oldest, newest)
    return bounds


async def _load_run_counts(
    session: AsyncSession,
    project_evaluator_ids: list[ProjectEvaluatorId],
    intervals: list[Interval],
) -> dict[Key, ProjectEvaluatorRunCounts]:
    # (key, outcome) -> [count, latest], summed over statuses and evaluation targets.
    totals: dict[tuple[Key, str], list[Any]] = {}
    async for row in await session.stream(_status_stmt(project_evaluator_ids, intervals)):
        project_evaluator_id, status = row[0], row[1]
        outcome = _OUTCOME_BY_STATUS.get(status)
        if outcome is None:
            continue
        for i, interval in enumerate(intervals):
            count, latest = row[2 + 2 * i], row[3 + 2 * i]
            if not count:
                continue
            total = totals.setdefault(((project_evaluator_id, *interval), outcome), [0, None])
            total[0] += count
            if latest is not None and (total[1] is None or latest > total[1]):
                total[1] = latest
    result: dict[Key, ProjectEvaluatorRunCounts] = {}
    for (key, outcome), (count, latest) in totals.items():
        counts = result.get(key, ProjectEvaluatorRunCounts())
        if outcome == _EVALUATED:
            counts = replace(counts, evaluated=count, last_evaluated_at=latest)
        elif outcome == _FAILED:
            counts = replace(counts, failed=count, last_failed_at=latest)
        elif outcome == _DROPPED:
            counts = replace(counts, dropped=count)
        else:
            counts = replace(counts, queued=count)
        result[key] = counts
    return result


async def _load_last_errors(
    session: AsyncSession,
    project_evaluator_ids: list[ProjectEvaluatorId],
    interval: Interval,
) -> dict[ProjectEvaluatorId, str]:
    newest: dict[ProjectEvaluatorId, tuple[datetime, str]] = {}
    async for project_evaluator_id, error, updated_at in await session.stream(
        _last_error_stmt(project_evaluator_ids, *interval)
    ):
        if project_evaluator_id not in newest or updated_at > newest[project_evaluator_id][0]:
            newest[project_evaluator_id] = (updated_at, error)
    return {project_evaluator_id: error for project_evaluator_id, (_, error) in newest.items()}


def _in_range(
    model: _WorkUnitModel, start: Optional[datetime], end: Optional[datetime]
) -> list[sa.ColumnElement[bool]]:
    conditions: list[sa.ColumnElement[bool]] = []
    if start is not None:
        conditions.append(model.updated_at >= start)
    if end is not None:
        conditions.append(model.updated_at < end)
    return conditions


def _failed(model: _WorkUnitModel) -> sa.ColumnElement[bool]:
    """A unit that was given up on — the only units whose errors the user is owed.

    SUPERSEDED (the evaluator's configuration changed under it) and CONTENT_LOST (the
    subject's content was gone by the time the unit was hydrated) are lifecycle events,
    not evaluation failures.
    DROPPED (shed from the backlog under load) is the system's doing, not the evaluator's.

    The statuses render as literals so the condition matches the partial
    ``ix_*_project_evaluator_failed`` indexes' predicate. SQLite needs this: with bound
    values (``status IN (?, ?)``) it can't prove the predicate, so it skips the index
    and sorts the evaluator's rows instead. Postgres only misses it under a forced
    generic plan. Don't simplify this back to ``.in_((...))``.
    """
    return model.status.in_(
        sa.bindparam(
            "failed_statuses",
            list(FAILED_EVAL_WORK_STATUSES),
            expanding=True,
            literal_execute=True,
        )
    )


# The funnel the user sees. SUPERSEDED and CONTENT_LOST fall outside every bucket,
# since no evaluation was ever owed for them, as do a session's FILTERED_OUT and
# SAMPLED_OUT decisions. DROPPED is its own bucket: the evaluation was owed and never
# ran, but nothing failed. Bucketed here rather than in SQL so the scan groups by the
# raw status, instead of evaluating a CASE on every row it reads.
_OUTCOME_BY_STATUS: dict[str, str] = {
    "DONE": _EVALUATED,
    **{status: _FAILED for status in FAILED_EVAL_WORK_STATUSES},
    "DROPPED": _DROPPED,
    **{status: _QUEUED for status in LIVE_EVAL_WORK_STATUSES},
}


def _status_stmt(
    project_evaluator_ids: list[ProjectEvaluatorId],
    intervals: list[Interval],
) -> sa.CompoundSelect[Any]:
    """Per evaluation target, evaluator, and status, a count and newest time for each interval.

    Row layout: ``(project_evaluator_id, status, count_0, latest_0, count_1, ...)``.
    A status can appear once per evaluation target; the caller sums them.
    """

    def status_counts(model: _WorkUnitModel) -> sa.Select[Any]:
        aggregates: list[sa.ColumnElement[Any]] = []
        for i, (start, end) in enumerate(intervals):
            conditions = _in_range(model, start, end)
            count: sa.ColumnElement[Any]
            latest: sa.ColumnElement[Any]
            if conditions:
                in_range = sa.and_(*conditions)
                count = sa.func.sum(sa.case((in_range, 1), else_=0))
                latest = sa.func.max(sa.case((in_range, model.updated_at), else_=None))
            else:
                count, latest = sa.func.count(), sa.func.max(model.updated_at)
            aggregates += [count.label(f"count_{i}"), latest.label(f"latest_{i}")]
        return (
            sa.select(
                model.project_evaluator_id.label("project_evaluator_id"),
                # The targets' status enums differ; read every one as plain text.
                sa.type_coerce(model.status, sa.String).label("status"),
                *aggregates,
            )
            .where(model.project_evaluator_id.in_(project_evaluator_ids))
            .group_by(model.project_evaluator_id, model.status)
        )

    return sa.union_all(*(status_counts(model) for model in _WORK_UNIT_MODELS))


def _last_error_stmt(
    project_evaluator_ids: list[ProjectEvaluatorId],
    start: Optional[datetime],
    end: Optional[datetime],
) -> sa.CompoundSelect[Any]:
    """Each evaluator's newest failure per evaluation target, with its error.

    Restricted to FAILED units: a unit that errored transiently and later succeeded
    keeps its error string (claim and complete never clear it), so the newest error
    of any unit would surface a stale message under a healthy evaluator.

    Each lookup walks the evaluator's partial failures index newest-first and stops
    at the first match, so an evaluator's successes are never read — however many
    there are, and even when it has never failed. The caller keeps the newest across
    evaluation targets.
    """

    def newest_failure(model: _WorkUnitModel) -> sa.Select[*tuple[Any, ...]]:
        candidate = aliased(model)
        newest_failure_id = (
            sa.select(candidate.id)
            .where(
                candidate.project_evaluator_id == models.ProjectEvaluator.id,
                _failed(candidate),
                candidate.error.is_not(None),
                *_in_range(candidate, start, end),
            )
            .order_by(candidate.updated_at.desc())
            .limit(1)
            .correlate(models.ProjectEvaluator)
            .scalar_subquery()
        )
        return (
            sa.select(model.project_evaluator_id, model.error, model.updated_at)
            .select_from(models.ProjectEvaluator)
            .join(model, model.id == newest_failure_id)
            .where(models.ProjectEvaluator.id.in_(project_evaluator_ids))
        )

    return sa.union_all(*(newest_failure(model) for model in _WORK_UNIT_MODELS))
