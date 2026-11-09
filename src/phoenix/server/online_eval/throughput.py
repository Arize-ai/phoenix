"""How fast evaluations are added to the queue and completed, per minute over the trailing
``RATE_WINDOW``. The evaluations added in the window are counted up to ``MAX_QUEUE_COUNT``."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.eval_work import COMPLETED_STATUSES, QUEUED_STATUSES
from phoenix.server.online_eval.current_queue import (
    EVALUATION_TARGETS,
    EvaluationQueue,
    ProjectQueue,
    capped,
    queued_rows,
)
from phoenix.server.online_eval.work_tables import WORK_TABLES, WorkTable, status_in
from phoenix.server.types import DbSessionFactory

RATE_WINDOW = timedelta(hours=1)


@dataclass(frozen=True)
class Throughput:
    """Evaluations added to the queue, and those completed (evaluated or failed), per
    minute."""

    added_per_minute: float
    completed_per_minute: float


@dataclass(frozen=True)
class QueueThroughput:
    """The queue's rates, from one read at the queue's measurement: of each evaluation
    target, in ``EVALUATION_TARGETS`` order, each project evaluator's evaluations added and
    completed over the trailing ``RATE_WINDOW``. The queue's, each target's, and each
    project's rates are sums of these, so they agree.
    """

    queue: EvaluationQueue
    project_evaluator_rates: tuple[dict[int, tuple[int, int]], ...]

    @property
    def targets(self) -> tuple[Throughput, ...]:
        return tuple(_throughput(rates.values()) for rates in self.project_evaluator_rates)

    @property
    def added_per_minute(self) -> float:
        return self._total.added_per_minute

    @property
    def completed_per_minute(self) -> float:
        return self._total.completed_per_minute

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


async def load_queue_throughput(db: DbSessionFactory, queue: EvaluationQueue) -> QueueThroughput:
    since = queue.measured_at - RATE_WINDOW
    async with db.read() as session:
        target_rates = tuple(
            [
                await _load_rates_by_project_evaluator(
                    session, WORK_TABLES[evaluation_target], since
                )
                for evaluation_target in EVALUATION_TARGETS
            ]
        )
    return QueueThroughput(queue=queue, project_evaluator_rates=target_rates)


async def _load_rates_by_project_evaluator(
    session: AsyncSession,
    table: WorkTable,
    since: datetime,
) -> dict[int, tuple[int, int]]:
    """Per project evaluator, of one target: the evaluations added since ``since``, and
    those completed since then. Evaluations still in queue are read newest first, where the
    window's are."""
    model = table.work_unit_model
    rates: dict[int, tuple[int, int]] = {}
    for status in QUEUED_STATUSES:
        tail = queued_rows(model, status, model.project_evaluator_id, model.created_at, newest=True)
        in_window = sa.func.sum(sa.case((tail.c.created_at >= since, 1), else_=0))
        for evaluator_id, added in await session.execute(
            sa.select(tail.c.project_evaluator_id, in_window).group_by(tail.c.project_evaluator_id)
        ):
            queued_added, _ = rates.get(evaluator_id, (0, 0))
            rates[evaluator_id] = (queued_added + (added or 0), 0)
    # Grouped by an expression, not the column, so SQLite reads through the terminal index
    # rather than walking every row in the order of the project evaluator index.
    project_evaluator_id = (model.project_evaluator_id + sa.literal_column("0")).label(
        "project_evaluator_id"
    )
    added_in_window = sa.func.sum(sa.case((model.created_at >= since, 1), else_=0))
    # Evaluations added within the window that already finished also finished within it, so
    # the terminal index finds them.
    for evaluator_id, completed, added in await session.execute(
        sa.select(
            project_evaluator_id,
            sa.func.sum(sa.case((model.status.in_(COMPLETED_STATUSES), 1), else_=0)),
            added_in_window,
        )
        .where(
            status_in(model, table.terminal_statuses),
            model.updated_at >= since,
        )
        .group_by(project_evaluator_id)
    ):
        queued_added, _ = rates.get(evaluator_id, (0, 0))
        rates[evaluator_id] = (queued_added + (added or 0), completed or 0)
    return rates


def _throughput(rates: Iterable[tuple[int, int]]) -> Throughput:
    added = completed = 0
    for added_in_window, completed_in_window in rates:
        added += added_in_window
        completed += completed_in_window
    window_minutes = RATE_WINDOW.total_seconds() / 60
    return Throughput(
        added_per_minute=capped(added) / window_minutes,
        completed_per_minute=completed / window_minutes,
    )
