"""How well online evaluation keeps up with what arrives.

Span, trace, and session evaluations wait in one queue, shared by every project. This module
is the one definition of what is queued, how long it has waited, how fast it fills and
drains, and whether it is healthy, for the queue and for each evaluation target's, each
project's and each project evaluator's share of it; GraphQL, project evaluator statuses,
and Prometheus all read it.
Every measure is read from the database, so replicas agree.

The queue has no limit, so every read of queued evaluations stops after ``MAX_QUEUE_COUNT``
rows: per project evaluator, or per evaluation target and status. Every count, including the
evaluations queued in the rate window, is at most ``MAX_QUEUE_COUNT``, so a count there means
at least that many.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Literal, Mapping, Optional, Sequence, Union

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.eval_work import (
    COMPLETED_EVAL_WORK_STATUSES,
    LIVE_EVAL_WORK_STATUSES,
    TERMINAL_EVAL_SESSION_WORK_STATUSES,
    TERMINAL_EVAL_WORK_STATUSES,
)
from phoenix.server.types import DbSessionFactory

MAX_QUEUE_COUNT = 1_000_000
RATE_WINDOW = timedelta(hours=1)
DEGRADED_QUEUE_WAIT = timedelta(minutes=10)
EVALUATION_LOAD_WINDOW = timedelta(hours=1)

EVALUATION_TARGETS: tuple[models.EvaluationTarget, ...] = ("SPAN", "TRACE", "SESSION")

QueueStatus = Literal["HEALTHY", "DEGRADED"]
ProjectEvaluatorRunStatus = Literal[
    "DISABLED", "ERROR", "DEGRADED", "RUNNING", "QUEUED", "NEVER_RUN"
]

_WorkUnitModel = Union[
    type[models.EvalWorkUnit],
    type[models.EvalTraceWorkUnit],
    type[models.EvalSessionWorkUnit],
]


@dataclass(frozen=True)
class _Queue:
    work_unit_model: _WorkUnitModel
    terminal_statuses: tuple[str, ...]


_QUEUES: dict[models.EvaluationTarget, _Queue] = {
    "SPAN": _Queue(
        work_unit_model=models.EvalWorkUnit,
        terminal_statuses=TERMINAL_EVAL_WORK_STATUSES,
    ),
    "TRACE": _Queue(
        work_unit_model=models.EvalTraceWorkUnit,
        terminal_statuses=TERMINAL_EVAL_SESSION_WORK_STATUSES,
    ),
    "SESSION": _Queue(
        work_unit_model=models.EvalSessionWorkUnit,
        terminal_statuses=TERMINAL_EVAL_SESSION_WORK_STATUSES,
    ),
}


@dataclass(frozen=True)
class QueuedWork:
    """Some queued evaluations: how many, how many of those are running, and when the oldest
    of those waiting to start was queued, retries included, and the oldest PENDING.
    """

    queued_count: int = 0
    running_count: int = 0
    oldest_queued_at: Optional[datetime] = None
    oldest_pending_at: Optional[datetime] = None


@dataclass(frozen=True)
class TargetQueue:
    """One evaluation target's evaluations in the queue.

    ``queued_count`` counts every queued evaluation: PENDING, RUNNING, or ERROR awaiting a
    retry. ``waiting`` covers only the PENDING ones, the line itself. A retry keeps its
    place and age, so with retries included one evaluator's provider outage would read as
    the whole line's wait.
    """

    evaluation_target: models.EvaluationTarget
    queued_count: int
    waiting: QueuedWork
    running_count: int
    retrying_count: int


@dataclass(frozen=True)
class EvaluationQueue:
    """The queue, as measured at ``measured_at``: what it holds of each evaluation target,
    in ``EVALUATION_TARGETS`` order. Everything a status needs, and nothing that costs more
    than reading the oldest queued evaluations.
    """

    measured_at: datetime
    targets: tuple[TargetQueue, ...]

    @property
    def queued_count(self) -> int:
        return _capped(sum(target.queued_count for target in self.targets))

    @property
    def running_count(self) -> int:
        return _capped(sum(target.running_count for target in self.targets))

    @property
    def retrying_count(self) -> int:
        return _capped(sum(target.retrying_count for target in self.targets))

    @property
    def waiting(self) -> QueuedWork:
        """The PENDING evaluations of every target; the oldest is the longest-waiting."""
        return QueuedWork(
            queued_count=_capped(sum(target.waiting.queued_count for target in self.targets)),
            oldest_queued_at=min(
                (
                    target.waiting.oldest_queued_at
                    for target in self.targets
                    if target.waiting.oldest_queued_at is not None
                ),
                default=None,
            ),
        )

    @property
    def status(self) -> QueueStatus:
        return "DEGRADED" if _waited_too_long(self.waiting, self.measured_at) else "HEALTHY"

    def target(self, evaluation_target: models.EvaluationTarget) -> TargetQueue:
        return self.targets[EVALUATION_TARGETS.index(evaluation_target)]

    def wait_seconds(self, work: QueuedWork) -> Optional[float]:
        """How long the oldest of ``work`` had waited when the queue was measured."""
        return _seconds_since(work.oldest_queued_at, self.measured_at)


@dataclass(frozen=True)
class ProjectTargetQueue:
    """One evaluation target's queued evaluations of one project."""

    evaluation_target: models.EvaluationTarget
    queued_count: int = 0
    running_count: int = 0


@dataclass(frozen=True)
class ProjectQueue:
    """One project's part of the queue, as measured at ``measured_at``: the queued
    evaluations of its project evaluators, of each evaluation target in
    ``EVALUATION_TARGETS`` order. ``oldest_queued_at`` is when the oldest of its PENDING
    evaluations was queued, as for ``EvaluationQueue.waiting``.
    """

    measured_at: datetime
    project_evaluator_ids: frozenset[int]
    targets: tuple[ProjectTargetQueue, ...]
    oldest_queued_at: Optional[datetime] = None

    @property
    def queued_count(self) -> int:
        return _capped(sum(target.queued_count for target in self.targets))

    @property
    def running_count(self) -> int:
        return _capped(sum(target.running_count for target in self.targets))


@dataclass(frozen=True)
class ProjectQueuedCount:
    project_id: int
    queued_count: int


@dataclass(frozen=True)
class Throughput:
    """How fast evaluations entered and left the queue, per minute over the trailing
    ``RATE_WINDOW``: ``queued_per_minute`` counts evaluations queued, and
    ``evaluations_per_minute`` those that left the queue evaluated or failed.
    """

    evaluations_per_minute: float
    queued_per_minute: float


@dataclass(frozen=True)
class QueueThroughput:
    """The queue's rates, from one read at the queue's measurement: of each evaluation
    target, in ``EVALUATION_TARGETS`` order, each project evaluator's evaluations queued, and
    those that left the queue evaluated or failed, over the trailing ``RATE_WINDOW``. The
    queue's, each target's, and each project's rates are sums of these, so they agree. The
    evaluations queued in the window are counted up to ``MAX_QUEUE_COUNT``.
    """

    queue: EvaluationQueue
    project_evaluator_rates: tuple[dict[int, tuple[int, int]], ...]

    @property
    def targets(self) -> tuple[Throughput, ...]:
        return tuple(_throughput(rates.values()) for rates in self.project_evaluator_rates)

    @property
    def evaluations_per_minute(self) -> float:
        return self._total.evaluations_per_minute

    @property
    def queued_per_minute(self) -> float:
        return self._total.queued_per_minute

    @property
    def _total(self) -> Throughput:
        return _throughput(
            rate for rates in self.project_evaluator_rates for rate in rates.values()
        )

    def target(self, evaluation_target: models.EvaluationTarget) -> Throughput:
        return self.targets[EVALUATION_TARGETS.index(evaluation_target)]

    def project(self, queue: ProjectQueue) -> Throughput:
        """One project's rates, of every evaluation target: the queue's, restricted to the
        project's evaluators."""
        return _throughput(
            (
                rates[project_evaluator_id]
                for rates in self.project_evaluator_rates
                for project_evaluator_id in queue.project_evaluator_ids
                if project_evaluator_id in rates
            )
        )


@dataclass(frozen=True)
class EvaluationLoad:
    """How much evaluation time one project evaluator used over the trailing
    ``EVALUATION_LOAD_WINDOW``, from the trace each of its evaluations writes to its trace
    project, placed by when the evaluation started. Queued evaluations cannot tell this:
    heartbeats renew their ``claimed_at``.

    Every project evaluator on the server shares one evaluator concurrency limit, whatever
    its project or evaluation target, so the share is of all their evaluation time.
    """

    evaluation_count: int
    evaluation_seconds: float
    server_evaluation_seconds: float

    @property
    def mean_evaluation_seconds(self) -> Optional[float]:
        if not self.evaluation_count:
            return None
        return self.evaluation_seconds / self.evaluation_count

    @property
    def share_of_evaluation_time(self) -> Optional[float]:
        if not self.server_evaluation_seconds:
            return None
        return self.evaluation_seconds / self.server_evaluation_seconds


def _waited_too_long(work: QueuedWork, now: datetime) -> bool:
    oldest = work.oldest_queued_at
    return oldest is not None and now - oldest > DEGRADED_QUEUE_WAIT


def project_evaluator_run_status(
    *,
    enabled: bool,
    last_evaluated_at: Optional[datetime],
    last_failed_at: Optional[datetime],
    queued: QueuedWork,
    now: datetime,
) -> ProjectEvaluatorRunStatus:
    """A project evaluator's one status, from its own work only, by precedence:
    DISABLED > ERROR > DEGRADED > RUNNING > QUEUED > NEVER_RUN.

    Its own oldest waiting evaluation, retries included, degrades it. The queue's status is
    not an input: the queue is shared, so it would mark every evaluator of every project
    alike, including ones with nothing queued.
    """
    if not enabled:
        return "DISABLED"
    if last_failed_at is not None and (
        last_evaluated_at is None or last_failed_at >= last_evaluated_at
    ):
        return "ERROR"
    if _waited_too_long(queued, now):
        return "DEGRADED"
    if last_evaluated_at is not None:
        return "RUNNING"
    if queued.queued_count:
        return "QUEUED"
    return "NEVER_RUN"


async def load_evaluation_queue(db: DbSessionFactory) -> EvaluationQueue:
    measured_at = datetime.now(timezone.utc)
    async with db.read() as session:
        targets = tuple(
            [
                await _load_target_queue(session, evaluation_target)
                for evaluation_target in EVALUATION_TARGETS
            ]
        )
    return EvaluationQueue(measured_at=measured_at, targets=targets)


async def _load_target_queue(
    session: AsyncSession,
    evaluation_target: models.EvaluationTarget,
) -> TargetQueue:
    """One target's queued evaluations, from the oldest of each status: the head of the line,
    where the longest wait is."""
    model = _QUEUES[evaluation_target].work_unit_model
    by_status: dict[str, tuple[int, Optional[datetime]]] = {}
    for status in LIVE_EVAL_WORK_STATUSES:
        head = _live_rows(model, status, model.created_at, newest=False)
        count, oldest_queued_at = (
            await session.execute(sa.select(sa.func.count(), sa.func.min(head.c.created_at)))
        ).one()
        by_status[status] = (count, oldest_queued_at)
    pending_count, oldest_pending_at = by_status["PENDING"]
    return TargetQueue(
        evaluation_target=evaluation_target,
        queued_count=_capped(sum(count for count, _ in by_status.values())),
        waiting=QueuedWork(queued_count=pending_count, oldest_queued_at=oldest_pending_at),
        running_count=by_status["RUNNING"][0],
        retrying_count=by_status["ERROR"][0],
    )


async def load_queue_throughput(db: DbSessionFactory, queue: EvaluationQueue) -> QueueThroughput:
    since = queue.measured_at - RATE_WINDOW
    async with db.read() as session:
        target_rates = tuple(
            [
                await _load_rates_by_project_evaluator(session, _QUEUES[evaluation_target], since)
                for evaluation_target in EVALUATION_TARGETS
            ]
        )
    return QueueThroughput(queue=queue, project_evaluator_rates=target_rates)


async def _load_rates_by_project_evaluator(
    session: AsyncSession,
    table: _Queue,
    since: datetime,
) -> dict[int, tuple[int, int]]:
    """Per project evaluator, of one target: the evaluations queued since ``since``, and
    those that left the queue evaluated or failed since then. Still-queued evaluations are
    read newest first, where the window's are."""
    model = table.work_unit_model
    rates: dict[int, tuple[int, int]] = {}
    for status in LIVE_EVAL_WORK_STATUSES:
        tail = _live_rows(model, status, model.project_evaluator_id, model.created_at, newest=True)
        in_window = sa.func.sum(sa.case((tail.c.created_at >= since, 1), else_=0))
        for evaluator_id, queued in await session.execute(
            sa.select(tail.c.project_evaluator_id, in_window).group_by(tail.c.project_evaluator_id)
        ):
            live_queued, _ = rates.get(evaluator_id, (0, 0))
            rates[evaluator_id] = (live_queued + (queued or 0), 0)
    # Grouped by an expression, not the column, so SQLite reads through the terminal index
    # rather than walking every row in the order of the project evaluator index.
    project_evaluator_id = (model.project_evaluator_id + sa.literal_column("0")).label(
        "project_evaluator_id"
    )
    queued_in_window = sa.func.sum(sa.case((model.created_at >= since, 1), else_=0))
    # Evaluations queued within the window that already ended also ended within it, so
    # the terminal index finds them.
    for evaluator_id, completed, queued in await session.execute(
        sa.select(
            project_evaluator_id,
            sa.func.sum(sa.case((model.status.in_(COMPLETED_EVAL_WORK_STATUSES), 1), else_=0)),
            queued_in_window,
        )
        .where(
            _status_in(model, table.terminal_statuses),
            model.updated_at >= since,
        )
        .group_by(project_evaluator_id)
    ):
        live_queued, _ = rates.get(evaluator_id, (0, 0))
        rates[evaluator_id] = (live_queued + (queued or 0), completed or 0)
    return rates


def _throughput(rates: Iterable[tuple[int, int]]) -> Throughput:
    queued = completed = 0
    for queued_in_window, completed_in_window in rates:
        queued += queued_in_window
        completed += completed_in_window
    window_minutes = RATE_WINDOW.total_seconds() / 60
    return Throughput(
        evaluations_per_minute=completed / window_minutes,
        queued_per_minute=_capped(queued) / window_minutes,
    )


async def load_evaluation_loads(
    db: DbSessionFactory,
    project_evaluator_ids: Sequence[int],
) -> dict[int, EvaluationLoad]:
    """Each project evaluator's evaluation load, from one read of every project evaluator's
    traces, since each share divides by all of them. The trace index on project and start
    time bounds the read to the window."""
    now = datetime.now(timezone.utc)
    trace = models.Trace
    async with db.read() as session:
        rows = (
            await session.execute(
                sa.select(
                    models.ProjectEvaluator.id,
                    sa.func.count(trace.id),
                    sa.func.sum(trace.latency_ms),
                )
                .join(trace, trace.project_rowid == models.ProjectEvaluator.trace_project_id)
                .where(
                    trace.start_time >= now - EVALUATION_LOAD_WINDOW,
                    trace.start_time < now,
                )
                .group_by(models.ProjectEvaluator.id)
            )
        ).all()
    evaluations = {
        project_evaluator_id: (count, float(milliseconds or 0) / 1000)
        for project_evaluator_id, count, milliseconds in rows
    }
    server_evaluation_seconds = sum(seconds for _, seconds in evaluations.values())
    return {
        project_evaluator_id: EvaluationLoad(
            *evaluations.get(project_evaluator_id, (0, 0.0)),
            server_evaluation_seconds=server_evaluation_seconds,
        )
        for project_evaluator_id in project_evaluator_ids
    }


@dataclass(frozen=True)
class ProjectEvaluatorTarget:
    """Which project a project evaluator belongs to, and the target whose queue holds its
    work."""

    id: int
    project_id: int
    evaluation_target: models.EvaluationTarget


async def load_project_evaluator_targets(
    db: DbSessionFactory,
    project_ids: Optional[Sequence[int]] = None,
) -> list[ProjectEvaluatorTarget]:
    """The project evaluators of ``project_ids``, or of every project."""
    async with db.read() as session:
        return await _load_project_evaluator_targets(
            session,
            sa.true()
            if project_ids is None
            else models.ProjectEvaluator.project_id.in_(project_ids),
        )


async def load_project_evaluator_queues(
    db: DbSessionFactory,
    project_evaluator_ids: Sequence[int],
) -> dict[int, QueuedWork]:
    """Each project evaluator's queued evaluations; evaluators with none are absent. The
    oldest is the earliest queued of those waiting to start, PENDING or awaiting a retry.
    Each evaluator's read takes at most ``MAX_QUEUE_COUNT`` of its oldest, through its
    target's per-evaluator live index."""
    async with db.read() as session:
        evaluators = await _load_project_evaluator_targets(
            session, models.ProjectEvaluator.id.in_(project_evaluator_ids)
        )
        result: dict[int, QueuedWork] = {}
        for start in range(0, len(evaluators), _EVALUATORS_PER_READ):
            reads = [
                _evaluator_queued_stmt(evaluator)
                for evaluator in evaluators[start : start + _EVALUATORS_PER_READ]
            ]
            for (
                project_evaluator_id,
                count,
                running_count,
                oldest_queued_at,
                oldest_pending_at,
            ) in await session.execute(sa.union_all(*reads) if len(reads) > 1 else reads[0]):
                if count:
                    result[project_evaluator_id] = QueuedWork(
                        queued_count=count,
                        running_count=running_count,
                        oldest_queued_at=oldest_queued_at,
                        oldest_pending_at=oldest_pending_at,
                    )
    return result


def project_queues(
    project_ids: Sequence[int],
    evaluators: Sequence[ProjectEvaluatorTarget],
    queued: Mapping[int, QueuedWork],
) -> dict[int, ProjectQueue]:
    """Each project's part of the queue, of every evaluator and evaluation target: the sums
    of its evaluators' queued evaluations, from ``load_project_evaluator_queues``."""
    measured_at = datetime.now(timezone.utc)
    project_evaluator_ids: dict[int, set[int]] = {project_id: set() for project_id in project_ids}
    by_target: dict[tuple[int, models.EvaluationTarget], list[QueuedWork]] = {}
    oldest_queued_at: dict[int, datetime] = {}
    for evaluator in evaluators:
        if evaluator.project_id not in project_evaluator_ids:
            continue
        project_evaluator_ids[evaluator.project_id].add(evaluator.id)
        if (evaluator_queued := queued.get(evaluator.id)) is None:
            continue
        by_target.setdefault((evaluator.project_id, evaluator.evaluation_target), []).append(
            evaluator_queued
        )
        if (oldest := evaluator_queued.oldest_pending_at) is not None:
            oldest_queued_at[evaluator.project_id] = min(
                oldest, oldest_queued_at.get(evaluator.project_id, oldest)
            )
    return {
        project_id: ProjectQueue(
            measured_at=measured_at,
            project_evaluator_ids=frozenset(ids),
            targets=tuple(
                _project_target_queue(
                    evaluation_target, by_target.get((project_id, evaluation_target), [])
                )
                for evaluation_target in EVALUATION_TARGETS
            ),
            oldest_queued_at=oldest_queued_at.get(project_id),
        )
        for project_id, ids in project_evaluator_ids.items()
    }


def queued_by_project(
    evaluators: Sequence[ProjectEvaluatorTarget],
    queued: Mapping[int, QueuedWork],
    limit: int,
) -> list[ProjectQueuedCount]:
    """The ``limit`` projects with the most queued evaluations, most first: the sums of
    their evaluators' queued evaluations, from ``load_project_evaluator_queues``."""
    by_project: dict[int, list[QueuedWork]] = {}
    for evaluator in evaluators:
        if (evaluator_queued := queued.get(evaluator.id)) is not None and (
            evaluator_queued.queued_count
        ):
            by_project.setdefault(evaluator.project_id, []).append(evaluator_queued)
    projects = sorted(
        (
            (sum(evaluator.queued_count for evaluator in project_evaluators), project_id)
            for project_id, project_evaluators in by_project.items()
        ),
        key=lambda project: (-project[0], project[1]),
    )
    return [
        ProjectQueuedCount(project_id=project_id, queued_count=_capped(queued_count))
        for queued_count, project_id in projects[:limit]
    ]


def _project_target_queue(
    evaluation_target: models.EvaluationTarget,
    evaluators: Sequence[QueuedWork],
) -> ProjectTargetQueue:
    return ProjectTargetQueue(
        evaluation_target=evaluation_target,
        queued_count=_capped(sum(evaluator.queued_count for evaluator in evaluators)),
        running_count=_capped(sum(evaluator.running_count for evaluator in evaluators)),
    )


async def _load_project_evaluator_targets(
    session: AsyncSession, condition: sa.ColumnElement[bool]
) -> list[ProjectEvaluatorTarget]:
    pe = models.ProjectEvaluator
    return [
        ProjectEvaluatorTarget(
            id=project_evaluator_id, project_id=project_id, evaluation_target=evaluation_target
        )
        for project_evaluator_id, project_id, evaluation_target in await session.execute(
            sa.select(pe.id, pe.project_id, pe.evaluation_target).where(condition)
        )
    ]


# SQLite allows at most 500 terms in one compound select.
_EVALUATORS_PER_READ = 250


def _evaluator_queued_stmt(
    evaluator: ProjectEvaluatorTarget,
) -> sa.Select[*tuple[Any, ...]]:
    model = _QUEUES[evaluator.evaluation_target].work_unit_model
    head = (
        sa.select(model.status, model.created_at)
        .where(
            model.project_evaluator_id == evaluator.id,
            _status_in(model, LIVE_EVAL_WORK_STATUSES),
        )
        .order_by(model.id)
        .limit(MAX_QUEUE_COUNT)
        .subquery()
    )
    return sa.select(
        sa.literal(evaluator.id, sa.Integer).label("project_evaluator_id"),
        sa.func.count(),
        sa.func.count(sa.case((head.c.status == "RUNNING", 1))),
        sa.func.min(sa.case((head.c.status.in_(("PENDING", "ERROR")), head.c.created_at))),
        sa.func.min(sa.case((head.c.status == "PENDING", head.c.created_at))),
    ).select_from(head)


def _live_rows(
    model: _WorkUnitModel,
    status: str,
    *columns: sa.orm.InstrumentedAttribute[Any],
    newest: bool,
) -> sa.Subquery:
    """At most the bound of one target's queued evaluations in ``status``, the oldest or the
    newest, read through its ``ix_*_claimable`` index."""
    return (
        sa.select(*columns)
        .where(_status_in(model, LIVE_EVAL_WORK_STATUSES), model.status == status)
        .order_by(model.id.desc() if newest else model.id)
        .limit(MAX_QUEUE_COUNT)
        .subquery()
    )


def _status_in(model: _WorkUnitModel, statuses: tuple[str, ...]) -> sa.ColumnElement[bool]:
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


def _capped(count: int) -> int:
    return min(count, MAX_QUEUE_COUNT)


def _seconds_since(then: Optional[datetime], now: datetime) -> Optional[float]:
    return None if then is None else max((now - then).total_seconds(), 0.0)
