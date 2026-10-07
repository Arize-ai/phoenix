"""How well online evaluation keeps up with what arrives.

Span, trace, and session evaluations wait in one queue, shared by every project, under one
limit. This module is the one definition of what is queued, how long it has waited, how
fast it fills and drains, and whether it is healthy, for the queue and for each evaluation
target's and each project's share of it; GraphQL, project evaluator statuses, and
Prometheus all read it.
Every measure is read from the database, so replicas agree.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, Literal, Optional, Sequence, Union

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.eval_work import (
    COMPLETED_EVAL_WORK_STATUSES,
    LIVE_EVAL_WORK_STATUSES,
    TERMINAL_EVAL_SESSION_WORK_STATUSES,
    TERMINAL_EVAL_WORK_STATUSES,
)
from phoenix.server.online_eval import admission
from phoenix.server.types import DbSessionFactory

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
    of those waiting to start was queued.
    """

    queued_count: int = 0
    running_count: int = 0
    oldest_queued_at: Optional[datetime] = None


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
    in ``EVALUATION_TARGETS`` order, and whether it is full. Everything a status needs, and
    nothing that costs more than reading the queued evaluations.
    """

    measured_at: datetime
    queued_limit: int
    targets: tuple[TargetQueue, ...]

    @property
    def queued_count(self) -> int:
        return sum(target.queued_count for target in self.targets)

    @property
    def running_count(self) -> int:
        return sum(target.running_count for target in self.targets)

    @property
    def retrying_count(self) -> int:
        return sum(target.retrying_count for target in self.targets)

    @property
    def waiting(self) -> QueuedWork:
        """The PENDING evaluations of every target; the oldest is the longest-waiting."""
        return QueuedWork(
            queued_count=sum(target.waiting.queued_count for target in self.targets),
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
    def at_capacity(self) -> bool:
        return self.queued_count >= self.queued_limit

    @property
    def status(self) -> QueueStatus:
        degraded = self.at_capacity or _waited_too_long(self.waiting, self.measured_at)
        return "DEGRADED" if degraded else "HEALTHY"

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
        return sum(target.queued_count for target in self.targets)

    @property
    def running_count(self) -> int:
        return sum(target.running_count for target in self.targets)


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
    """The queue's rates, and each evaluation target's, in ``EVALUATION_TARGETS`` order."""

    queue: EvaluationQueue
    targets: tuple[Throughput, ...]

    @property
    def evaluations_per_minute(self) -> float:
        return sum(target.evaluations_per_minute for target in self.targets)

    @property
    def queued_per_minute(self) -> float:
        return sum(target.queued_per_minute for target in self.targets)

    def target(self, evaluation_target: models.EvaluationTarget) -> Throughput:
        return self.targets[EVALUATION_TARGETS.index(evaluation_target)]


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
    return EvaluationQueue(
        measured_at=measured_at,
        queued_limit=admission.max_queued(),
        targets=targets,
    )


async def _load_target_queue(
    session: AsyncSession,
    evaluation_target: models.EvaluationTarget,
) -> TargetQueue:
    queue = _QUEUES[evaluation_target]
    model = queue.work_unit_model
    by_status: dict[str, tuple[int, Optional[datetime]]] = {
        status: (count, oldest_queued_at)
        for status, count, oldest_queued_at in await session.execute(
            sa.select(model.status, sa.func.count(), sa.func.min(model.created_at))
            .where(_status_in(model, LIVE_EVAL_WORK_STATUSES))
            .group_by(model.status)
        )
    }
    pending_count, oldest_pending_at = by_status.get("PENDING", (0, None))
    return TargetQueue(
        evaluation_target=evaluation_target,
        queued_count=sum(count for count, _ in by_status.values()),
        waiting=QueuedWork(queued_count=pending_count, oldest_queued_at=oldest_pending_at),
        running_count=by_status.get("RUNNING", (0, None))[0],
        retrying_count=by_status.get("ERROR", (0, None))[0],
    )


async def load_queue_throughput(db: DbSessionFactory, queue: EvaluationQueue) -> QueueThroughput:
    since = queue.measured_at - RATE_WINDOW
    async with db.read() as session:
        targets = tuple(
            [
                _throughput(
                    (
                        await _load_rates_by_project_evaluator(
                            session, _QUEUES[evaluation_target], since
                        )
                    ).values()
                )
                for evaluation_target in EVALUATION_TARGETS
            ]
        )
    return QueueThroughput(queue=queue, targets=targets)


async def load_project_queue_throughputs(
    db: DbSessionFactory,
    queues: Sequence[ProjectQueue],
) -> list[Throughput]:
    """Each project's rates, of every evaluation target: the queue's rates, restricted to
    the project's evaluators."""
    rates_by_measurement: dict[datetime, list[dict[int, tuple[int, int]]]] = {}
    async with db.read() as session:
        for measured_at in {queue.measured_at for queue in queues}:
            rates_by_measurement[measured_at] = [
                await _load_rates_by_project_evaluator(
                    session, target_queue, measured_at - RATE_WINDOW
                )
                for target_queue in _QUEUES.values()
            ]
    return [
        _throughput(
            rates[project_evaluator_id]
            for rates in rates_by_measurement[queue.measured_at]
            for project_evaluator_id in queue.project_evaluator_ids
            if project_evaluator_id in rates
        )
        for queue in queues
    ]


async def _load_rates_by_project_evaluator(
    session: AsyncSession,
    table: _Queue,
    since: datetime,
) -> dict[int, tuple[int, int]]:
    """Per project evaluator, of one target: the evaluations queued since ``since``, and
    those that left the queue evaluated or failed since then."""
    model = table.work_unit_model
    # Grouped by an expression, not the column, so SQLite reads through the status indexes
    # rather than walking every row in the order of the project evaluator index.
    project_evaluator_id = (model.project_evaluator_id + sa.literal_column("0")).label(
        "project_evaluator_id"
    )
    queued_in_window = sa.func.sum(sa.case((model.created_at >= since, 1), else_=0))
    rates: dict[int, tuple[int, int]] = {
        evaluator_id: (queued or 0, 0)
        for evaluator_id, queued in await session.execute(
            sa.select(project_evaluator_id, queued_in_window)
            .where(_status_in(model, LIVE_EVAL_WORK_STATUSES))
            .group_by(project_evaluator_id)
        )
    }
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
        queued_per_minute=queued / window_minutes,
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


async def load_project_evaluator_queues(
    db: DbSessionFactory,
    project_evaluator_ids: Sequence[int],
) -> dict[int, QueuedWork]:
    """Each project evaluator's queued evaluations; evaluators with none are absent. The
    oldest is the earliest queued of those waiting to start, PENDING or awaiting a retry.

    Reads every queued evaluation of each target, which the queue's limit bounds, rather
    than each evaluator's history.
    """
    requested = set(project_evaluator_ids)
    result: dict[int, QueuedWork] = {}
    async with db.read() as session:
        for queue in _QUEUES.values():
            for project_evaluator_id, evaluator in (
                await _load_queued_by_project_evaluator(session, queue)
            ).items():
                if project_evaluator_id in requested:
                    result[project_evaluator_id] = QueuedWork(
                        queued_count=evaluator.queued_count,
                        running_count=evaluator.running_count,
                        oldest_queued_at=evaluator.oldest_queued_at,
                    )
    return result


async def load_project_queues(
    db: DbSessionFactory,
    project_ids: Sequence[int],
) -> dict[int, ProjectQueue]:
    """Each project's part of the queue, of every evaluator and evaluation target.

    Like ``load_project_evaluator_queues``, reads every queued evaluation of each target,
    which the queue's limit bounds, rather than each evaluator's history.
    """
    measured_at = datetime.now(timezone.utc)
    project_evaluator_ids: dict[int, set[int]] = {project_id: set() for project_id in project_ids}
    targets: dict[int, list[ProjectTargetQueue]] = {project_id: [] for project_id in project_ids}
    oldest_queued_at: dict[int, datetime] = {}
    async with db.read() as session:
        for project_evaluator_id, project_id in await session.execute(
            sa.select(models.ProjectEvaluator.id, models.ProjectEvaluator.project_id).where(
                models.ProjectEvaluator.project_id.in_(project_ids)
            )
        ):
            project_evaluator_ids[project_id].add(project_evaluator_id)
        for evaluation_target in EVALUATION_TARGETS:
            queue = _QUEUES[evaluation_target]
            by_project_evaluator = await _load_queued_by_project_evaluator(session, queue)
            for project_id, ids in project_evaluator_ids.items():
                evaluators = [by_project_evaluator[i] for i in ids if i in by_project_evaluator]
                targets[project_id].append(
                    ProjectTargetQueue(
                        evaluation_target=evaluation_target,
                        queued_count=sum(evaluator.queued_count for evaluator in evaluators),
                        running_count=sum(evaluator.running_count for evaluator in evaluators),
                    )
                )
                for evaluator in evaluators:
                    if (oldest := evaluator.oldest_pending_at) is not None:
                        oldest_queued_at[project_id] = min(
                            oldest, oldest_queued_at.get(project_id, oldest)
                        )
    return {
        project_id: ProjectQueue(
            measured_at=measured_at,
            project_evaluator_ids=frozenset(ids),
            targets=tuple(targets[project_id]),
            oldest_queued_at=oldest_queued_at.get(project_id),
        )
        for project_id, ids in project_evaluator_ids.items()
    }


async def load_queued_by_project(db: DbSessionFactory, limit: int) -> list[tuple[int, int]]:
    """The ``limit`` projects with the most queued evaluations, most first, as
    ``(project_id, queued_count)``. One read of every queued evaluation of each target, which
    the queue's limit bounds."""
    queued = sa.union_all(
        *(
            sa.select(queue.work_unit_model.project_evaluator_id).where(
                _status_in(queue.work_unit_model, LIVE_EVAL_WORK_STATUSES)
            )
            for queue in _QUEUES.values()
        )
    ).subquery()
    by_project = models.ProjectEvaluator.project_id
    queued_count = sa.func.count()
    async with db.read() as session:
        rows = await session.execute(
            sa.select(by_project, queued_count)
            .select_from(queued)
            .join(
                models.ProjectEvaluator, models.ProjectEvaluator.id == queued.c.project_evaluator_id
            )
            .group_by(by_project)
            .order_by(queued_count.desc(), by_project)
            .limit(limit)
        )
        return [(project_id, count) for project_id, count in rows]


@dataclass(frozen=True)
class _EvaluatorQueued:
    queued_count: int
    running_count: int
    # When the oldest PENDING or awaiting a retry was queued, and the oldest PENDING.
    oldest_queued_at: Optional[datetime]
    oldest_pending_at: Optional[datetime]


async def _load_queued_by_project_evaluator(
    session: AsyncSession,
    queue: _Queue,
) -> dict[int, _EvaluatorQueued]:
    """The queued evaluations of one target, per project evaluator with any."""
    model = queue.work_unit_model
    rows = await session.execute(
        sa.select(
            model.project_evaluator_id,
            sa.func.count(),
            sa.func.count(sa.case((model.status == "RUNNING", model.id))),
            sa.func.min(sa.case((model.status.in_(("PENDING", "ERROR")), model.created_at))),
            sa.func.min(sa.case((model.status == "PENDING", model.created_at))),
        )
        .where(_status_in(model, LIVE_EVAL_WORK_STATUSES))
        .group_by(model.project_evaluator_id)
    )
    return {
        project_evaluator_id: _EvaluatorQueued(
            queued_count=count,
            running_count=running_count,
            oldest_queued_at=oldest_queued_at,
            oldest_pending_at=oldest_pending_at,
        )
        for project_evaluator_id, count, running_count, oldest_queued_at, oldest_pending_at in rows
    }


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


def _seconds_since(then: Optional[datetime], now: datetime) -> Optional[float]:
    return None if then is None else max((now - then).total_seconds(), 0.0)
