"""How well online evaluation keeps up with what arrives.

Each evaluation target has one queue, shared by every project. This module is the one
definition of what is queued, how long it has waited, how fast it fills and drains, and
whether it is healthy; GraphQL, project evaluator statuses, and Prometheus all read it.
Every measure is read from the database, so replicas agree.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional, Sequence, Union

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.eval_work import (
    COMPLETED_EVAL_WORK_STATUSES,
    LIVE_EVAL_WORK_STATUSES,
    TERMINAL_EVAL_SESSION_WORK_STATUSES,
    TERMINAL_EVAL_WORK_STATUSES,
)
from phoenix.server.online_eval.admission import max_queued
from phoenix.server.types import DbSessionFactory

RATE_WINDOW = timedelta(minutes=15)
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
    """Some queued evaluations: how many, and when the oldest of those waiting to start was
    queued. The oldest is the head, by the order evaluations were queued.
    """

    queued_count: int = 0
    oldest_queued_at: Optional[datetime] = None


@dataclass(frozen=True)
class EvaluationQueue:
    """One evaluation target's queue, as measured at ``measured_at``: what it holds, and
    whether its admission gate is closed. Everything a status needs, and nothing that
    costs more than reading the queued evaluations.

    ``queued_count`` counts every queued evaluation: PENDING, RUNNING, or ERROR awaiting a
    retry. ``waiting`` covers only the PENDING ones, the line itself. A retry keeps its
    place and age, so with retries included one evaluator's provider outage would read as
    the whole line's wait.
    """

    evaluation_target: models.EvaluationTarget
    measured_at: datetime
    queued_count: int
    waiting: QueuedWork
    running_count: int
    retrying_count: int
    at_capacity: bool

    @property
    def oldest_wait_seconds(self) -> Optional[float]:
        return _seconds_since(self.waiting.oldest_queued_at, self.measured_at)

    @property
    def status(self) -> QueueStatus:
        degraded = self.at_capacity or _waited_too_long(self.waiting, self.measured_at)
        return "DEGRADED" if degraded else "HEALTHY"


@dataclass(frozen=True)
class QueueThroughput:
    """How fast a queue fills and drains, per minute over the trailing ``RATE_WINDOW``:
    ``queued_per_minute`` counts evaluations queued, and ``evaluations_per_minute`` those
    that left the queue evaluated or failed.
    """

    queue: EvaluationQueue
    evaluations_per_minute: float
    queued_per_minute: float


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
    def evaluations_per_minute(self) -> float:
        return self.evaluation_count / (EVALUATION_LOAD_WINDOW.total_seconds() / 60)

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
    target_queue_degraded: bool,
    now: datetime,
) -> ProjectEvaluatorRunStatus:
    """A project evaluator's one status, by precedence:
    DISABLED > ERROR > DEGRADED > RUNNING > QUEUED > NEVER_RUN.

    A degraded queue degrades every evaluator on it, queued work or not, since each one's
    next evaluation waits in that line. An evaluator's own oldest waiting evaluation,
    retries included, degrades it alone, which catches one stuck retrying while the line
    moves.
    """
    if not enabled:
        return "DISABLED"
    if last_failed_at is not None and (
        last_evaluated_at is None or last_failed_at >= last_evaluated_at
    ):
        return "ERROR"
    if target_queue_degraded or _waited_too_long(queued, now):
        return "DEGRADED"
    if last_evaluated_at is not None:
        return "RUNNING"
    if queued.queued_count:
        return "QUEUED"
    return "NEVER_RUN"


async def load_evaluation_queue(
    db: DbSessionFactory,
    evaluation_target: models.EvaluationTarget,
) -> EvaluationQueue:
    queue = _QUEUES[evaluation_target]
    model = queue.work_unit_model
    measured_at = datetime.now(timezone.utc)
    async with db.read() as session:
        by_status = {
            status: (count, head_id)
            for status, count, head_id in await session.execute(
                sa.select(model.status, sa.func.count(), sa.func.min(model.id))
                .where(_status_in(model, LIVE_EVAL_WORK_STATUSES))
                .group_by(model.status)
            )
        }
        pending_count, head_id = by_status.get("PENDING", (0, None))
        oldest_pending_at: Optional[datetime] = None
        if head_id is not None:
            heads = await _load_heads(session, queue, [head_id])
            oldest_pending_at = heads[head_id]
    queued_count = sum(count for count, _ in by_status.values())
    return EvaluationQueue(
        evaluation_target=evaluation_target,
        measured_at=measured_at,
        queued_count=queued_count,
        waiting=QueuedWork(queued_count=pending_count, oldest_queued_at=oldest_pending_at),
        running_count=by_status.get("RUNNING", (0, None))[0],
        retrying_count=by_status.get("ERROR", (0, None))[0],
        at_capacity=queued_count >= max_queued(evaluation_target),
    )


async def load_queue_throughput(db: DbSessionFactory, queue: EvaluationQueue) -> QueueThroughput:
    table = _QUEUES[queue.evaluation_target]
    model = table.work_unit_model
    since = queue.measured_at - RATE_WINDOW
    queued_in_window = sa.func.sum(sa.case((model.created_at >= since, 1), else_=0))
    async with db.read() as session:
        live_queued_in_window = await session.scalar(
            sa.select(queued_in_window).where(_status_in(model, LIVE_EVAL_WORK_STATUSES))
        )
        # Evaluations queued within the window that already ended also ended within it, so
        # the terminal index finds them.
        completed_in_window, ended_queued_in_window = (
            await session.execute(
                sa.select(
                    sa.func.sum(
                        sa.case((model.status.in_(COMPLETED_EVAL_WORK_STATUSES), 1), else_=0)
                    ),
                    queued_in_window,
                ).where(
                    _status_in(model, table.terminal_statuses),
                    model.updated_at >= since,
                )
            )
        ).one()
    window_minutes = RATE_WINDOW.total_seconds() / 60
    return QueueThroughput(
        queue=queue,
        evaluations_per_minute=(completed_in_window or 0) / window_minutes,
        queued_per_minute=((live_queued_in_window or 0) + (ended_queued_in_window or 0))
        / window_minutes,
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
    oldest is the head of those waiting to start, PENDING or awaiting a retry.

    Reads every queued evaluation of each target, which the admission cap bounds, rather
    than each evaluator's history.
    """
    requested = set(project_evaluator_ids)
    result: dict[int, QueuedWork] = {}
    async with db.read() as session:
        for queue in _QUEUES.values():
            model = queue.work_unit_model
            waiting = model.status.in_(("PENDING", "ERROR"))
            aggregates = [
                row
                for row in await session.execute(
                    sa.select(
                        model.project_evaluator_id,
                        sa.func.count(),
                        sa.func.min(sa.case((waiting, model.id))),
                    )
                    .where(_status_in(model, LIVE_EVAL_WORK_STATUSES))
                    .group_by(model.project_evaluator_id)
                )
                if row[0] in requested
            ]
            heads = await _load_heads(
                session, queue, [head_id for _, _, head_id in aggregates if head_id is not None]
            )
            for project_evaluator_id, count, head_id in aggregates:
                result[project_evaluator_id] = QueuedWork(
                    queued_count=count,
                    oldest_queued_at=heads.get(head_id),
                )
    return result


async def _load_heads(
    session: AsyncSession,
    queue: _Queue,
    head_ids: Sequence[int],
) -> dict[int, datetime]:
    """When each head-of-queue evaluation was queued."""
    if not head_ids:
        return {}
    model = queue.work_unit_model
    rows = await session.execute(
        sa.select(model.id, model.created_at).where(model.id.in_(head_ids))
    )
    return {head_id: queued_at for head_id, queued_at in rows}


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
