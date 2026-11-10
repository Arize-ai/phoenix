from datetime import datetime, timedelta, timezone
from typing import Optional, Sequence

import pytest

from phoenix.db import models
from phoenix.server.api.dataloaders.evaluation_queues import EvaluationQueueProjectsDataLoader
from phoenix.server.api.dataloaders.project_evaluation_queues import (
    ProjectEvaluationQueueDataLoader,
)
from phoenix.server.api.dataloaders.project_evaluator_queues import (
    ProjectEvaluatorQueuesDataLoader,
)
from phoenix.server.online_eval import current_queue
from phoenix.server.online_eval.current_queue import (
    ProjectEvaluatorQueue,
    ProjectQueuedCount,
    load_evaluation_queue,
    load_project_evaluator_queues,
)
from phoenix.server.online_eval.evaluation_activity import load_added_and_completed
from phoenix.server.online_eval.evaluator_status import (
    ProjectEvaluatorRunStatus,
    project_evaluator_run_status,
)
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_span, _add_trace
from .test_span_producer import _seed_criteria


async def test_span_queue_health(db: DbSessionFactory) -> None:
    now = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        retried_span = await _add_span(session, trace, start_time=now - timedelta(hours=5))
        old_spans = iter(
            [await _add_span(session, trace, start_time=now - timedelta(hours=2)) for _ in range(9)]
        )
        await _add_span(session, trace, start_time=now - timedelta(minutes=1))
    _, project_evaluator_id = await _seed_criteria(db, project.id)

    def unit(
        status: str,
        *,
        queued_ago: timedelta,
        finished_ago: Optional[timedelta] = None,
        span: Optional[models.Span] = None,
    ) -> models.EvalWorkUnit:
        return models.EvalWorkUnit(
            span_rowid=(span or next(old_spans)).id,
            project_evaluator_id=project_evaluator_id,
            status=status,
            created_at=now - queued_ago,
            updated_at=now - (finished_ago or queued_ago),
        )

    async with db() as session:
        # Retrying since a provider outage hours ago: first in queue order, but not in line.
        session.add(unit("ERROR", queued_ago=timedelta(hours=3), span=retried_span))
        await session.flush()
        session.add(unit("PENDING", queued_ago=timedelta(minutes=20)))
        await session.flush()
        session.add_all(
            [
                unit("PENDING", queued_ago=timedelta(minutes=2)),
                unit("RUNNING", queued_ago=timedelta(minutes=5)),
                unit("DONE", queued_ago=timedelta(minutes=10), finished_ago=timedelta(minutes=5)),
                unit("DONE", queued_ago=timedelta(minutes=10), finished_ago=timedelta(minutes=4)),
                # Queued before the window but finished in it: completed, not queued.
                unit("FAILED", queued_ago=timedelta(minutes=70), finished_ago=timedelta(minutes=3)),
                # Cleared before it ran: queued in the window, but neither evaluated nor failed.
                unit("DROPPED", queued_ago=timedelta(minutes=8), finished_ago=timedelta(minutes=2)),
                unit("DONE", queued_ago=timedelta(minutes=90), finished_ago=timedelta(minutes=70)),
            ]
        )

    queue = await load_evaluation_queue(db)
    added, completed = await load_added_and_completed(
        db, project_id=None, start=now - timedelta(hours=1), end=now
    )
    spans = queue.target("SPAN")

    # Queued or running, retries included.
    assert spans.queued_count == 4
    assert (spans.waiting_count, spans.running_count, spans.retrying_count) == (2, 1, 1)
    assert spans.oldest_waiting_at == now - timedelta(minutes=20)
    assert queue.oldest_waiting_at == spans.oldest_waiting_at
    assert (queue.queued_count, queue.running_count) == (4, 1)
    # The head of the line has waited 20 minutes.
    assert queue.status == "DEGRADED"
    assert (added, completed) == (6, 3)


async def _seed_pending_spans(
    db: DbSessionFactory, project: models.Project, queued_ago: Sequence[timedelta]
) -> int:
    """A span evaluator of ``project`` with one PENDING evaluation per ``queued_ago``."""
    now = datetime.now(timezone.utc)
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    async with db() as session:
        trace = await _add_trace(session, project)
        for ago in queued_ago:
            session.add(
                models.EvalWorkUnit(
                    span_rowid=(await _add_span(session, trace)).id,
                    project_evaluator_id=project_evaluator_id,
                    created_at=now - ago,
                )
            )
            await session.flush()
    return project_evaluator_id


async def test_queue_counts_stop_at_the_limit(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(current_queue, "MAX_QUEUE_COUNT", 2)
    async with db() as session:
        project = await _add_project(session)
    busy = await _seed_pending_spans(db, project, [timedelta(minutes=1)] * 3)
    # Queued after the busy evaluator's work, so past the head of the shared line.
    stuck = await _seed_pending_spans(db, project, [timedelta(minutes=20)])
    async with db() as session:
        session.add(
            models.EvalWorkUnit(
                span_rowid=(await _add_span(session)).id,
                project_evaluator_id=stuck,
                status="RUNNING",
            )
        )

    queue = await load_evaluation_queue(db)
    spans = queue.target("SPAN")
    assert (spans.queued_count, spans.waiting_count, spans.running_count) == (2, 2, 1)
    assert queue.queued_count == 2

    evaluators = await load_project_evaluator_queues(db, [busy, stuck])
    assert (evaluators[busy].queued_count, evaluators[stuck].queued_count) == (2, 2)
    assert evaluators[stuck].oldest_waiting_or_retrying_at is not None
    assert (
        project_evaluator_run_status(
            enabled=True,
            last_evaluated_at=None,
            last_failed_at=None,
            queued=evaluators[stuck],
            now=datetime.now(timezone.utc),
        )
        == "DEGRADED"
    )

    evaluator_queues = ProjectEvaluatorQueuesDataLoader(db)
    project_queue = await ProjectEvaluationQueueDataLoader(db, evaluator_queues).load(project.id)
    assert (project_queue.queued_count, project_queue.targets[0].queued_count) == (2, 2)
    assert await EvaluationQueueProjectsDataLoader(db, evaluator_queues).load(5) == [
        ProjectQueuedCount(project_id=project.id, queued_count=2)
    ]


async def test_summed_queue_counts_stay_at_the_limit(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(current_queue, "MAX_QUEUE_COUNT", 2)
    async with db() as session:
        project = await _add_project(session)
    await _seed_pending_spans(db, project, [timedelta(minutes=1)] * 3)
    _, trace_evaluator_id = await _seed_criteria(db, project.id, evaluation_target="TRACE")
    async with db() as session:
        for _ in range(3):
            session.add(
                models.EvalTraceWorkUnit(
                    trace_rowid=(await _add_trace(session, project)).id,
                    project_evaluator_id=trace_evaluator_id,
                    decided_through=datetime.now(timezone.utc),
                )
            )

    queue = await load_evaluation_queue(db)
    assert [queue.target(target).queued_count for target in ("SPAN", "TRACE")] == [2, 2]
    assert queue.queued_count == 2
    project_queue = await ProjectEvaluationQueueDataLoader(
        db, ProjectEvaluatorQueuesDataLoader(db)
    ).load(project.id)
    assert project_queue.queued_count == 2


async def test_oldest_wait_is_the_earliest_queued_not_the_lowest_id(
    db: DbSessionFactory,
) -> None:
    now = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        traces = [await _add_trace(session, project) for _ in range(2)]
    _, project_evaluator_id = await _seed_criteria(db, project.id, evaluation_target="TRACE")

    def unit(trace: models.Trace, queued_ago: timedelta) -> models.EvalTraceWorkUnit:
        return models.EvalTraceWorkUnit(
            trace_rowid=trace.id,
            project_evaluator_id=project_evaluator_id,
            decided_through=now,
            status="PENDING",
            created_at=now - queued_ago,
        )

    async with db() as session:
        # Re-offering a trace keeps its row's id and resets when it was queued.
        reoffered = unit(traces[0], queued_ago=timedelta(seconds=30))
        session.add(reoffered)
        await session.flush()
        waiting = unit(traces[1], queued_ago=timedelta(minutes=20))
        session.add(waiting)
        await session.flush()
        assert reoffered.id < waiting.id

    queue = await load_evaluation_queue(db)
    project_queue = await ProjectEvaluationQueueDataLoader(
        db, ProjectEvaluatorQueuesDataLoader(db)
    ).load(project.id)
    evaluator_queues = await load_project_evaluator_queues(db, [project_evaluator_id])

    oldest = [
        queue.target("TRACE").oldest_waiting_at,
        project_queue.oldest_waiting_at,
        evaluator_queues[project_evaluator_id].oldest_waiting_or_retrying_at,
    ]
    assert oldest == [now - timedelta(minutes=20)] * 3
    assert all(at is not None and at.tzinfo is not None for at in oldest)
    assert queue.status == "DEGRADED"


@pytest.mark.parametrize(
    ("enabled", "evaluated_ago", "failed_ago", "waited", "expected"),
    [
        (False, timedelta(seconds=5), timedelta(seconds=1), timedelta(hours=1), "DISABLED"),
        (True, timedelta(minutes=5), timedelta(seconds=1), timedelta(hours=1), "ERROR"),
        # Its own oldest queued evaluation, a retry, has waited an hour.
        (True, timedelta(seconds=5), None, timedelta(hours=1), "DEGRADED"),
        (True, timedelta(seconds=5), timedelta(minutes=5), timedelta(0), "HEALTHY"),
        (True, None, None, timedelta(0), "STARTING"),
        (True, None, None, None, "NEVER_RUN"),
    ],
)
def test_project_evaluator_run_status_precedence(
    enabled: bool,
    evaluated_ago: Optional[timedelta],
    failed_ago: Optional[timedelta],
    waited: Optional[timedelta],
    expected: ProjectEvaluatorRunStatus,
) -> None:
    now = datetime.now(timezone.utc)
    queued = (
        ProjectEvaluatorQueue()
        if waited is None
        else ProjectEvaluatorQueue(queued_count=1, oldest_waiting_or_retrying_at=now - waited)
    )
    status = project_evaluator_run_status(
        enabled=enabled,
        last_evaluated_at=None if evaluated_ago is None else now - evaluated_ago,
        last_failed_at=None if failed_ago is None else now - failed_ago,
        queued=queued,
        now=now,
    )
    assert status == expected
