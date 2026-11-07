"""What is in the online evaluation queue now: for the queue, each evaluation target, each
project and each project evaluator. GraphQL, project evaluator statuses and Prometheus all
read it, from the database, so replicas agree.

In queue means waiting (PENDING), retrying after an error (ERROR) or running (RUNNING). The
queue has no limit, so every read stops after ``MAX_QUEUE_COUNT`` rows: per project
evaluator, or per evaluation target and status. A count at ``MAX_QUEUE_COUNT`` means at
least that many.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Mapping, Optional, Sequence

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.eval_work import QUEUED_STATUSES
from phoenix.server.online_eval.work_tables import WORK_TABLES, WorkUnitModel, status_in
from phoenix.server.types import DbSessionFactory

MAX_QUEUE_COUNT = 1_000_000
DEGRADED_QUEUE_WAIT = timedelta(minutes=10)

EVALUATION_TARGETS: tuple[models.EvaluationTarget, ...] = ("SPAN", "TRACE", "SESSION")

QueueStatus = Literal["HEALTHY", "DEGRADED"]


@dataclass(frozen=True)
class TargetQueue:
    """One evaluation target's evaluations in the queue.

    ``oldest_waiting_at`` is when the oldest waiting (PENDING) evaluation was queued. A retry
    keeps its place and age, so with retries included one evaluator's provider outage would
    read as the whole queue's wait.
    """

    evaluation_target: models.EvaluationTarget
    queued_count: int
    waiting_count: int
    running_count: int
    retrying_count: int
    oldest_waiting_at: Optional[datetime]


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
        return capped(sum(target.queued_count for target in self.targets))

    @property
    def running_count(self) -> int:
        return capped(sum(target.running_count for target in self.targets))

    @property
    def oldest_waiting_at(self) -> Optional[datetime]:
        return min(
            (
                target.oldest_waiting_at
                for target in self.targets
                if target.oldest_waiting_at is not None
            ),
            default=None,
        )

    @property
    def status(self) -> QueueStatus:
        return (
            "DEGRADED" if waited_too_long(self.oldest_waiting_at, self.measured_at) else "HEALTHY"
        )

    def target(self, evaluation_target: models.EvaluationTarget) -> TargetQueue:
        return self.targets[EVALUATION_TARGETS.index(evaluation_target)]

    def wait_seconds(self, oldest_waiting_at: Optional[datetime]) -> Optional[float]:
        """How long an evaluation queued at ``oldest_waiting_at`` had waited when the queue
        was measured."""
        return _seconds_since(oldest_waiting_at, self.measured_at)


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
    ``EVALUATION_TARGETS`` order, and when the oldest of their waiting (PENDING) evaluations
    was queued.
    """

    measured_at: datetime
    project_evaluator_ids: frozenset[int]
    targets: tuple[ProjectTargetQueue, ...]
    oldest_waiting_at: Optional[datetime] = None

    @property
    def queued_count(self) -> int:
        return capped(sum(target.queued_count for target in self.targets))

    @property
    def running_count(self) -> int:
        return capped(sum(target.running_count for target in self.targets))


@dataclass(frozen=True)
class ProjectQueuedCount:
    project_id: int
    queued_count: int


@dataclass(frozen=True)
class ProjectEvaluatorQueue:
    """One project evaluator's evaluations in the queue, and when the oldest of them that is
    waiting or retrying was queued, and the oldest waiting (PENDING) one."""

    queued_count: int = 0
    running_count: int = 0
    oldest_waiting_or_retrying_at: Optional[datetime] = None
    oldest_waiting_at: Optional[datetime] = None


@dataclass(frozen=True)
class ProjectEvaluatorTarget:
    """Which project a project evaluator belongs to, and the target whose queue holds its
    work."""

    id: int
    project_id: int
    evaluation_target: models.EvaluationTarget


def waited_too_long(oldest_waiting_at: Optional[datetime], now: datetime) -> bool:
    return oldest_waiting_at is not None and now - oldest_waiting_at > DEGRADED_QUEUE_WAIT


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
    model = WORK_TABLES[evaluation_target].work_unit_model
    by_status: dict[str, tuple[int, Optional[datetime]]] = {}
    for status in QUEUED_STATUSES:
        head = queued_rows(model, status, model.created_at, newest=False)
        count, oldest_created_at = (
            await session.execute(sa.select(sa.func.count(), sa.func.min(head.c.created_at)))
        ).one()
        by_status[status] = (count, oldest_created_at)
    waiting_count, oldest_waiting_at = by_status["PENDING"]
    return TargetQueue(
        evaluation_target=evaluation_target,
        queued_count=capped(sum(count for count, _ in by_status.values())),
        waiting_count=waiting_count,
        running_count=by_status["RUNNING"][0],
        retrying_count=by_status["ERROR"][0],
        oldest_waiting_at=oldest_waiting_at,
    )


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
) -> dict[int, ProjectEvaluatorQueue]:
    """Each project evaluator's queued evaluations; evaluators with none are absent. Each
    evaluator's count reads at most ``MAX_QUEUE_COUNT`` of its rows, and each oldest one row,
    through its target's ``ix_*_project_evaluator_live`` index."""
    async with db.read() as session:
        evaluators = await _load_project_evaluator_targets(
            session, models.ProjectEvaluator.id.in_(project_evaluator_ids)
        )
        result: dict[int, ProjectEvaluatorQueue] = {}
        for start in range(0, len(evaluators), _EVALUATORS_PER_READ):
            reads = [
                _evaluator_queued_stmt(evaluator)
                for evaluator in evaluators[start : start + _EVALUATORS_PER_READ]
            ]
            for (
                project_evaluator_id,
                count,
                running_count,
                oldest_waiting_at,
                oldest_retrying_at,
            ) in await session.execute(sa.union_all(*reads) if len(reads) > 1 else reads[0]):
                if count:
                    result[project_evaluator_id] = ProjectEvaluatorQueue(
                        queued_count=count,
                        running_count=running_count,
                        oldest_waiting_or_retrying_at=min(
                            (at for at in (oldest_waiting_at, oldest_retrying_at) if at),
                            default=None,
                        ),
                        oldest_waiting_at=oldest_waiting_at,
                    )
    return result


def project_queues(
    project_ids: Sequence[int],
    evaluators: Sequence[ProjectEvaluatorTarget],
    queued: Mapping[int, ProjectEvaluatorQueue],
) -> dict[int, ProjectQueue]:
    """Each project's part of the queue, of every evaluator and evaluation target: the sums
    of its evaluators' queued evaluations, from ``load_project_evaluator_queues``."""
    measured_at = datetime.now(timezone.utc)
    project_evaluator_ids: dict[int, set[int]] = {project_id: set() for project_id in project_ids}
    by_target: dict[tuple[int, models.EvaluationTarget], list[ProjectEvaluatorQueue]] = {}
    oldest_waiting_at: dict[int, datetime] = {}
    for evaluator in evaluators:
        if evaluator.project_id not in project_evaluator_ids:
            continue
        project_evaluator_ids[evaluator.project_id].add(evaluator.id)
        if (evaluator_queued := queued.get(evaluator.id)) is None:
            continue
        by_target.setdefault((evaluator.project_id, evaluator.evaluation_target), []).append(
            evaluator_queued
        )
        if (oldest := evaluator_queued.oldest_waiting_at) is not None:
            oldest_waiting_at[evaluator.project_id] = min(
                oldest, oldest_waiting_at.get(evaluator.project_id, oldest)
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
            oldest_waiting_at=oldest_waiting_at.get(project_id),
        )
        for project_id, ids in project_evaluator_ids.items()
    }


def queued_by_project(
    evaluators: Sequence[ProjectEvaluatorTarget],
    queued: Mapping[int, ProjectEvaluatorQueue],
    limit: int,
) -> list[ProjectQueuedCount]:
    """The ``limit`` projects with the most queued evaluations, most first: the sums of
    their evaluators' queued evaluations, from ``load_project_evaluator_queues``."""
    by_project: dict[int, list[ProjectEvaluatorQueue]] = {}
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
        ProjectQueuedCount(project_id=project_id, queued_count=capped(queued_count))
        for queued_count, project_id in projects[:limit]
    ]


def queued_rows(
    model: WorkUnitModel,
    status: str,
    *columns: sa.orm.InstrumentedAttribute[Any],
    newest: bool,
) -> sa.Subquery:
    """At most ``MAX_QUEUE_COUNT`` of one target's queued evaluations in ``status``, the
    oldest or the newest, read through its ``ix_*_claimable`` index."""
    return (
        sa.select(*columns)
        .where(status_in(model, QUEUED_STATUSES), model.status == status)
        .order_by(model.id.desc() if newest else model.id)
        .limit(MAX_QUEUE_COUNT)
        .subquery()
    )


def capped(count: int) -> int:
    return min(count, MAX_QUEUE_COUNT)


def _project_target_queue(
    evaluation_target: models.EvaluationTarget,
    evaluators: Sequence[ProjectEvaluatorQueue],
) -> ProjectTargetQueue:
    return ProjectTargetQueue(
        evaluation_target=evaluation_target,
        queued_count=capped(sum(evaluator.queued_count for evaluator in evaluators)),
        running_count=capped(sum(evaluator.running_count for evaluator in evaluators)),
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
    model = WORK_TABLES[evaluator.evaluation_target].work_unit_model
    in_queue = (model.project_evaluator_id == evaluator.id, status_in(model, QUEUED_STATUSES))
    rows = sa.select(model.status).where(*in_queue).limit(MAX_QUEUE_COUNT).subquery()

    def oldest(status: str) -> sa.ScalarSelect[Any]:
        # The status comes first so SQLite seeks by it rather than by the queued statuses,
        # reads the index in age order and stops at one row.
        return (
            sa.select(model.created_at)
            .where(model.status == status, *in_queue)
            .order_by(model.created_at)
            .limit(1)
            .scalar_subquery()
        )

    return sa.select(
        sa.literal(evaluator.id, sa.Integer).label("project_evaluator_id"),
        sa.func.count(),
        sa.func.count(sa.case((rows.c.status == "RUNNING", 1))),
        oldest("PENDING"),
        oldest("ERROR"),
    ).select_from(rows)


def _seconds_since(then: Optional[datetime], now: datetime) -> Optional[float]:
    return None if then is None else max((now - then).total_seconds(), 0.0)
