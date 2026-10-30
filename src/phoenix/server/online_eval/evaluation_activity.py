"""What online evaluation did over a time range: how many evaluations it completed, how long
each waited for its result, what the evaluators' own traces cost, and how full the queue was.

Activity is read for one project, grouped by project evaluator, or for the server, grouped by
project. Every read is bounded by the time range, from the work rows and from the traces each
evaluation writes to its project evaluator's trace project.

An evaluation's lag is from when it was queued, its work row's ``created_at``, to its result,
the ``updated_at`` of the row's last transition. Work rows are not written once they reach an
outcome, except that a trace or session evaluation that ended without a result is offered
again when its trace or session has newer spans: the row returns to the queue with a new
``created_at``, and the earlier offer leaves no record. Rows are deleted with their span,
trace, session, or project evaluator, and finished span work is deleted once it is older than
the online evaluation retention period, so a range reaching past it counts less than it covers.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional, Sequence, Union

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.functions import percentile_cont
from typing_extensions import TypeAlias, assert_never

from phoenix.datetime_utils import normalize_datetime
from phoenix.db import models
from phoenix.db.eval_work import (
    COMPLETED_EVAL_WORK_STATUSES,
    LIVE_EVAL_WORK_STATUSES,
    TERMINAL_EVAL_SESSION_WORK_STATUSES,
    TERMINAL_EVAL_WORK_STATUSES,
)
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.models import LatencyMs
from phoenix.server.api.input_types.TimeBinConfig import TimeBucketSpec
from phoenix.server.types import DbSessionFactory

_WorkUnitModel: TypeAlias = Union[
    type[models.EvalWorkUnit],
    type[models.EvalTraceWorkUnit],
    type[models.EvalSessionWorkUnit],
]
_WORK_TABLES: tuple[tuple[_WorkUnitModel, tuple[str, ...]], ...] = (
    (models.EvalWorkUnit, TERMINAL_EVAL_WORK_STATUSES),
    (models.EvalTraceWorkUnit, TERMINAL_EVAL_SESSION_WORK_STATUSES),
    (models.EvalSessionWorkUnit, TERMINAL_EVAL_SESSION_WORK_STATUSES),
)
_ProjectEvaluatorIds: TypeAlias = Union[Sequence[int], sa.Select[Any]]
_GroupKey: TypeAlias = int


@dataclass(frozen=True)
class EvaluationLag:
    """Percentiles of the seconds from queued to result."""

    p50_seconds: float
    p95_seconds: float
    p99_seconds: float


@dataclass(frozen=True)
class ActivityGroup:
    """One project evaluator's activity, or one project's, over the whole range."""

    project_id: int
    project_evaluator_id: Optional[int]
    evaluated_count: int = 0
    failed_count: int = 0
    lag: Optional[EvaluationLag] = None
    cost: Optional[float] = None


@dataclass(frozen=True)
class ActivityBinGroup:
    """One group's activity in one time bin. ``queue_size`` is how many of its evaluations
    were queued or running at the bin's end."""

    project_id: int
    project_evaluator_id: Optional[int]
    evaluated_count: int = 0
    failed_count: int = 0
    queued_count: int = 0
    lag_p95_seconds: Optional[float] = None
    cost: Optional[float] = None
    queue_size: int = 0


@dataclass(frozen=True)
class ActivityBin:
    timestamp: datetime
    groups: tuple[ActivityBinGroup, ...]


@dataclass(frozen=True)
class EvaluationActivity:
    evaluated_count: int
    failed_count: int
    lag: Optional[EvaluationLag]
    cost: Optional[float]
    groups: tuple[ActivityGroup, ...]
    series: tuple[ActivityBin, ...]


async def load_evaluation_lags(
    db: DbSessionFactory,
    project_evaluator_ids: Sequence[int],
    start: datetime,
    end: datetime,
) -> dict[int, EvaluationLag]:
    """The lag of each project evaluator's evaluations completed in ``[start, end)``;
    evaluators with none are absent."""
    completed = _completed(project_evaluator_ids, start, end)
    group = completed.c.project_evaluator_id
    stmt = sa.select(group, *_lag_percentiles(db.dialect, completed.c.lag_seconds)).group_by(group)
    async with db.read() as session:
        return {
            project_evaluator_id: lag
            for project_evaluator_id, *percentiles in await session.execute(stmt)
            if (lag := _lag(*percentiles)) is not None
        }


async def load_evaluation_activity(
    db: DbSessionFactory,
    *,
    project_id: Optional[int],
    start: datetime,
    end: datetime,
    time_bins: TimeBucketSpec,
) -> EvaluationActivity:
    """Activity of one project's evaluators, grouped by project evaluator, or, with no
    ``project_id``, of every project evaluator on the server, grouped by project."""
    scope = sa.select(models.ProjectEvaluator.id)
    if project_id is not None:
        scope = scope.where(models.ProjectEvaluator.project_id == project_id)
    reader = _ActivityReader(
        dialect=db.dialect,
        by_project=project_id is None,
        scope=scope,
        start=start,
        end=end,
        time_bins=time_bins,
    )
    async with db.read() as session:
        return await reader.read(session)


@dataclass
class _GroupBin:
    evaluated_count: int = 0
    failed_count: int = 0
    queued_count: int = 0
    lag_p95_seconds: Optional[float] = None
    cost: Optional[float] = None


@dataclass
class _GroupTotals:
    evaluated_count: int = 0
    failed_count: int = 0
    lag: Optional[EvaluationLag] = None
    cost: Optional[float] = None
    bins: dict[int, _GroupBin] = field(default_factory=dict)
    queue_sizes: list[int] = field(default_factory=list)


@dataclass(frozen=True)
class _ActivityReader:
    dialect: SupportedSQLDialect
    by_project: bool
    scope: sa.Select[Any]
    start: datetime
    end: datetime
    time_bins: TimeBucketSpec

    async def read(self, session: AsyncSession) -> EvaluationActivity:
        bins = list(self.time_bins.timestamps(self.start, self.end))
        bin_index = {timestamp: i for i, timestamp in enumerate(bins)}
        project_ids: dict[_GroupKey, int] = {}
        async for project_evaluator_id, project_id in await session.stream(
            sa.select(models.ProjectEvaluator.id, models.ProjectEvaluator.project_id).where(
                models.ProjectEvaluator.id.in_(self.scope)
            )
        ):
            project_ids[project_id if self.by_project else project_evaluator_id] = project_id
        groups = {key: _GroupTotals(queue_sizes=[0] * len(bins)) for key in project_ids}

        completed = _completed(self.scope, self.start, self.end)
        group = self._group(completed)
        evaluated = sa.func.sum(completed.c.evaluated)
        lag_seconds = completed.c.lag_seconds
        bucket = self.time_bins.truncate(self.dialect, completed.c.completed_at)
        async for key, timestamp, evaluated_count, count, lag_p95 in await session.stream(
            sa.select(
                group,
                bucket,
                evaluated,
                sa.func.count(),
                _percentile(self.dialect, lag_seconds, 0.95),
            )
            .select_from(completed)
            .group_by(group, bucket)
        ):
            if key not in groups:
                continue
            group_bin = groups[key].bins.setdefault(bin_index[_as_datetime(timestamp)], _GroupBin())
            group_bin.evaluated_count = evaluated_count
            group_bin.failed_count = count - evaluated_count
            group_bin.lag_p95_seconds = lag_p95
        async for key, evaluated_count, count, *percentiles in await session.stream(
            sa.select(
                group, evaluated, sa.func.count(), *_lag_percentiles(self.dialect, lag_seconds)
            )
            .select_from(completed)
            .group_by(group)
        ):
            if (totals := groups.get(key)) is None:
                continue
            totals.evaluated_count = evaluated_count
            totals.failed_count = count - evaluated_count
            totals.lag = _lag(*percentiles)
        total_percentiles = (
            await session.execute(
                sa.select(*_lag_percentiles(self.dialect, lag_seconds)).select_from(completed)
            )
        ).one()
        lag = _lag(*total_percentiles)

        await self._read_queue(session, groups, bin_index)
        await self._read_cost(session, groups, bin_index)

        group_keys = sorted(
            groups,
            key=lambda key: (-(groups[key].evaluated_count + groups[key].failed_count), key),
        )
        costs = [totals.cost for totals in groups.values() if totals.cost is not None]
        return EvaluationActivity(
            evaluated_count=sum(totals.evaluated_count for totals in groups.values()),
            failed_count=sum(totals.failed_count for totals in groups.values()),
            lag=lag,
            cost=sum(costs) if costs else None,
            groups=tuple(
                ActivityGroup(
                    *self._identity(key, project_ids[key]),
                    evaluated_count=groups[key].evaluated_count,
                    failed_count=groups[key].failed_count,
                    lag=groups[key].lag,
                    cost=groups[key].cost,
                )
                for key in group_keys
            ),
            series=tuple(
                ActivityBin(
                    timestamp=timestamp,
                    groups=tuple(
                        ActivityBinGroup(
                            *self._identity(key, project_ids[key]),
                            evaluated_count=group_bin.evaluated_count,
                            failed_count=group_bin.failed_count,
                            queued_count=group_bin.queued_count,
                            lag_p95_seconds=group_bin.lag_p95_seconds,
                            cost=group_bin.cost,
                            queue_size=queue_size,
                        )
                        for key in group_keys
                        for group_bin, queue_size in [
                            (groups[key].bins.get(i, _GroupBin()), groups[key].queue_sizes[i])
                        ]
                        if i in groups[key].bins or queue_size
                    ),
                )
                for i, timestamp in enumerate(bins)
            ),
        )

    async def _read_queue(
        self,
        session: AsyncSession,
        groups: dict[_GroupKey, _GroupTotals],
        bin_index: dict[datetime, int],
    ) -> None:
        """Evaluations queued in each bin, and the queue's size at each bin's end, from one
        read of the evaluations queued at any time in the range: those still queued, and
        those that left the queue in or after it."""
        queued = _queued(self.scope, self.start, self.end)
        entered_at, exited_at = queued.c.entered_at, queued.c.exited_at
        entered_bin = sa.case(
            (entered_at < self.start, None),
            else_=self.time_bins.truncate(self.dialect, entered_at),
        )
        exited_bin = sa.case(
            (sa.or_(exited_at.is_(None), exited_at >= self.end), None),
            else_=self.time_bins.truncate(self.dialect, exited_at),
        )
        bin_count = len(bin_index)
        changes: dict[_GroupKey, list[int]] = defaultdict(lambda: [0] * (bin_count + 1))
        group = self._group(queued)
        async for key, entered, exited, count in await session.stream(
            sa.select(group, entered_bin, exited_bin, sa.func.count())
            .select_from(queued)
            .group_by(group, entered_bin, exited_bin)
        ):
            if key not in groups:
                continue
            entered_index = -1 if entered is None else bin_index[_as_datetime(entered)]
            exited_index = bin_count if exited is None else bin_index[_as_datetime(exited)]
            if entered_index >= 0:
                groups[key].bins.setdefault(entered_index, _GroupBin()).queued_count += count
            changes[key][max(entered_index, 0)] += count
            changes[key][exited_index] -= count
        for key, deltas in changes.items():
            size = 0
            for i in range(bin_count):
                size += deltas[i]
                groups[key].queue_sizes[i] = size

    async def _read_cost(
        self,
        session: AsyncSession,
        groups: dict[_GroupKey, _GroupTotals],
        bin_index: dict[datetime, int],
    ) -> None:
        trace = models.Trace
        project_evaluator = models.ProjectEvaluator
        bucket = self.time_bins.truncate(self.dialect, trace.start_time)
        group = project_evaluator.project_id if self.by_project else project_evaluator.id
        async for key, timestamp, cost in await session.stream(
            sa.select(group, bucket, sa.func.sum(models.SpanCost.total_cost))
            .select_from(project_evaluator)
            .join(trace, trace.project_rowid == project_evaluator.trace_project_id)
            .join(models.SpanCost, models.SpanCost.trace_rowid == trace.id)
            .where(
                project_evaluator.id.in_(self.scope),
                trace.start_time >= self.start,
                trace.start_time < self.end,
            )
            .group_by(group, bucket)
        ):
            if (totals := groups.get(key)) is None:
                continue
            cost = float(cost or 0)
            totals.bins.setdefault(bin_index[_as_datetime(timestamp)], _GroupBin()).cost = cost
            totals.cost = (totals.cost or 0) + cost

    def _group(self, rows: sa.Subquery) -> sa.ColumnElement[int]:
        """The group of rows keyed by project evaluator. The project is looked up per row:
        joined instead, SQLite materializes the rows and indexes them to drive the join from
        the project evaluators, at several times the cost."""
        if not self.by_project:
            return rows.c.project_evaluator_id
        project_id: sa.ColumnElement[int] = (
            sa.select(models.ProjectEvaluator.project_id)
            .where(models.ProjectEvaluator.id == rows.c.project_evaluator_id)
            .scalar_subquery()
        )
        return project_id

    def _identity(self, key: _GroupKey, project_id: int) -> tuple[int, Optional[int]]:
        return project_id, None if self.by_project else key


def _completed(
    project_evaluator_ids: _ProjectEvaluatorIds,
    start: datetime,
    end: datetime,
) -> sa.Subquery:
    """Evaluations that produced an annotation or were given up on in ``[start, end)``, each
    with its lag, read through each table's ``ix_*_terminal`` index on ``updated_at``.

    The evaluator is matched as an expression so neither dialect reads by an evaluator index
    instead. SQLite estimates an IN subquery as many evaluators and then scans the whole
    table rather than search ``ix_*_project_evaluator_done`` once per evaluator.
    """
    branches: list[sa.Select[*tuple[Any, ...]]] = []
    for model, terminal_statuses in _WORK_TABLES:
        branches.append(
            sa.select(
                model.project_evaluator_id.label("project_evaluator_id"),
                sa.case((model.status == "DONE", 1), else_=0).label("evaluated"),
                model.updated_at.label("completed_at"),
                (LatencyMs(model.created_at, model.updated_at) / 1000).label("lag_seconds"),
            ).where(
                _status_in(model, terminal_statuses),
                _status_in(model, COMPLETED_EVAL_WORK_STATUSES),
                _evaluator_in(model, project_evaluator_ids),
                model.updated_at >= start,
                model.updated_at < end,
            )
        )
    return sa.union_all(*branches).subquery("completed")


def _queued(
    project_evaluator_ids: sa.Select[Any],
    start: datetime,
    end: datetime,
) -> sa.Subquery:
    """Evaluations queued before ``end`` and still queued, or queued before ``end`` that left
    the queue at or after ``start``, with when each entered and left.

    Still-queued rows are read through ``ix_*_claimable``, which the queue's limit bounds, and
    rows that left through ``ix_*_terminal`` from ``start``. The evaluator is matched as an
    expression so neither dialect reads each evaluator's whole history by its index instead.
    Rows inserted already declined never entered the queue, and no branch reads them.
    """
    branches: list[sa.Select[*tuple[Any, ...]]] = []
    for model, terminal_statuses in _WORK_TABLES:
        in_scope = (model.project_evaluator_id + sa.literal_column("0")).in_(project_evaluator_ids)
        branches.append(
            sa.select(
                model.project_evaluator_id.label("project_evaluator_id"),
                model.created_at.label("entered_at"),
                sa.null().label("exited_at"),
            ).where(_status_in(model, LIVE_EVAL_WORK_STATUSES), in_scope, model.created_at < end)
        )
        branches.append(
            sa.select(
                model.project_evaluator_id.label("project_evaluator_id"),
                model.created_at.label("entered_at"),
                model.updated_at.label("exited_at"),
            ).where(
                _status_in(model, terminal_statuses),
                in_scope,
                model.updated_at >= start,
                model.created_at < end,
            )
        )
    return sa.union_all(*branches).subquery("queued")


def _lag_percentiles(
    dialect: SupportedSQLDialect, lag_seconds: sa.ColumnElement[float]
) -> tuple[sa.ColumnElement[float], ...]:
    return tuple(_percentile(dialect, lag_seconds, fraction) for fraction in (0.5, 0.95, 0.99))


def _percentile(
    dialect: SupportedSQLDialect, value: sa.ColumnElement[float], fraction: float
) -> sa.ColumnElement[float]:
    if dialect is SupportedSQLDialect.POSTGRESQL:
        return percentile_cont(fraction).within_group(value.asc())
    if dialect is SupportedSQLDialect.SQLITE:
        percentile: sa.ColumnElement[float] = sa.func.percentile(value, fraction * 100)
        return percentile
    assert_never(dialect)


def _lag(*percentiles: Optional[float]) -> Optional[EvaluationLag]:
    p50, p95, p99 = percentiles
    if p50 is None or p95 is None or p99 is None:
        return None
    return EvaluationLag(p50_seconds=p50, p95_seconds=p95, p99_seconds=p99)


def _evaluator_in(
    model: Any, project_evaluator_ids: _ProjectEvaluatorIds
) -> sa.ColumnElement[bool]:
    condition: sa.ColumnElement[bool] = (model.project_evaluator_id + sa.literal_column("0")).in_(
        project_evaluator_ids
    )
    return condition


def _status_in(model: Any, statuses: tuple[str, ...]) -> sa.ColumnElement[bool]:
    """Statuses render as literals so SQLite matches the work tables' partial indexes."""
    condition: sa.ColumnElement[bool] = model.status.in_(
        sa.bindparam(
            "statuses",
            list(statuses),
            expanding=True,
            literal_execute=True,
            unique=True,
        )
    )
    return condition


def _as_datetime(value: Any) -> datetime:
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    if not isinstance(value, datetime):
        raise ValueError(f"Cannot convert {value} to datetime")
    return normalize_datetime(value, timezone.utc)  # type: ignore[return-value]
