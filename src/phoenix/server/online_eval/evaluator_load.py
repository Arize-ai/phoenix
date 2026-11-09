"""How much of the server's evaluation time each project evaluator used."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional, Sequence

import sqlalchemy as sa

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

EVALUATION_LOAD_WINDOW = timedelta(hours=1)


@dataclass(frozen=True)
class EvaluationLoad:
    """How much evaluation time one project evaluator used over the trailing
    ``EVALUATION_LOAD_WINDOW``, from the trace each of its evaluations writes to its trace
    project, placed by when the evaluation started. Queued evaluations cannot tell this:
    heartbeats renew their ``claimed_at``.

    Every project evaluator on the server shares one evaluator concurrency limit, whatever
    its project or evaluation target, so the share is of all their evaluation time.

    An evaluator with tracing off writes no traces, so its load is unknown: it has no mean
    or share, and its evaluation time is missing from the server total.
    ``excludes_untraced_evaluators`` says when that total leaves out an enabled evaluator
    for that reason, so a share can be read as a share of traced evaluation time.
    """

    evaluation_count: int
    evaluation_seconds: float
    server_evaluation_seconds: float
    tracing_enabled: bool = True
    excludes_untraced_evaluators: bool = False

    @property
    def mean_evaluation_seconds(self) -> Optional[float]:
        if not self.tracing_enabled or not self.evaluation_count:
            return None
        return self.evaluation_seconds / self.evaluation_count

    @property
    def share_of_evaluation_time(self) -> Optional[float]:
        if not self.tracing_enabled or not self.server_evaluation_seconds:
            return None
        return self.evaluation_seconds / self.server_evaluation_seconds


async def load_evaluation_loads(
    db: DbSessionFactory,
    project_evaluator_ids: Sequence[int],
) -> dict[int, EvaluationLoad]:
    """Each project evaluator's evaluation load, from one read of every project evaluator's
    traces, since each share divides by all of them. The trace index on project and start
    time bounds the read to the window."""
    now = datetime.now(timezone.utc)
    trace = models.Trace
    project_evaluator = models.ProjectEvaluator
    async with db.read() as session:
        # One read of the evaluators with tracing off gives both the requested evaluators'
        # state and whether the server total leaves out an enabled one.
        untraced = (
            await session.execute(
                sa.select(project_evaluator.id, project_evaluator.enabled).where(
                    project_evaluator.tracing_enabled.is_(False)
                )
            )
        ).all()
        untraced_ids = {project_evaluator_id for project_evaluator_id, _ in untraced}
        excludes_untraced_evaluators = any(enabled for _, enabled in untraced)
        rows = (
            await session.execute(
                sa.select(
                    models.ProjectEvaluator.id,
                    sa.func.count(trace.id),
                    sa.func.sum(trace.latency_ms),
                )
                .join(trace, trace.project_rowid == models.ProjectEvaluator.trace_project_id)
                .where(
                    models.ProjectEvaluator.deleted_at.is_(None),
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
            tracing_enabled=project_evaluator_id not in untraced_ids,
            excludes_untraced_evaluators=excludes_untraced_evaluators,
        )
        for project_evaluator_id in project_evaluator_ids
    }
