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
from phoenix.server.online_eval import queue_health
from phoenix.server.online_eval.queue_health import (
    EvaluationQueue,
    ProjectEvaluatorRunStatus,
    ProjectQueue,
    ProjectQueuedCount,
    QueuedWork,
    QueueThroughput,
    load_evaluation_queue,
    load_project_evaluator_queues,
    load_queue_throughput,
    project_evaluator_run_status,
)
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_span, _add_trace
from .test_producer import _seed_criteria


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
    throughput = await load_queue_throughput(db, queue)
    spans = queue.target("SPAN")

    # Queued or running, retries included.
    assert spans.queued_count == 4
    assert (spans.waiting.queued_count, spans.running_count, spans.retrying_count) == (2, 1, 1)
    assert spans.waiting.oldest_queued_at == now - timedelta(minutes=20)
    assert queue.waiting == spans.waiting
    assert (queue.queued_count, queue.running_count, queue.retrying_count) == (4, 1, 1)
    # The head of the line has waited 20 minutes.
    assert queue.status == "DEGRADED"
    assert throughput.target("SPAN").evaluations_per_minute == pytest.approx(3 / 60)
    assert throughput.target("SPAN").queued_per_minute == pytest.approx(6 / 60)
    assert throughput.queued_per_minute == pytest.approx(6 / 60)


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
    monkeypatch.setattr(queue_health, "MAX_QUEUE_COUNT", 2)
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
    assert (spans.queued_count, spans.waiting.queued_count, spans.running_count) == (2, 2, 1)
    assert queue.queued_count == 2

    evaluators = await load_project_evaluator_queues(db, [busy, stuck])
    assert (evaluators[busy].queued_count, evaluators[stuck].queued_count) == (2, 2)
    assert evaluators[stuck].oldest_queued_at is not None
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


def test_queued_rate_stops_at_the_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(queue_health, "MAX_QUEUE_COUNT", 2)
    now = datetime.now(timezone.utc)
    throughput = QueueThroughput(
        queue=EvaluationQueue(measured_at=now, targets=()),
        project_evaluator_rates=({1: (1, 0), 2: (2, 0)}, {3: (3, 0)}, {}),
    )
    project = ProjectQueue(measured_at=now, project_evaluator_ids=frozenset({1, 2}), targets=())

    assert [target.queued_per_minute for target in throughput.targets] == [2 / 60, 2 / 60, 0]
    assert throughput.queued_per_minute == 2 / 60
    assert throughput.project(project).queued_per_minute == 2 / 60


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
            evaluated_through=now,
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

    oldest_queued_at = [
        queue.target("TRACE").waiting.oldest_queued_at,
        project_queue.oldest_queued_at,
        evaluator_queues[project_evaluator_id].oldest_queued_at,
    ]
    assert oldest_queued_at == [now - timedelta(minutes=20)] * 3
    assert all(at is not None and at.tzinfo is not None for at in oldest_queued_at)
    assert queue.status == "DEGRADED"


_WAITING_BRIEFLY = QueuedWork(queued_count=1, oldest_queued_at=datetime.now(timezone.utc))
_WAITING_LONG = QueuedWork(
    queued_count=1, oldest_queued_at=datetime.now(timezone.utc) - timedelta(hours=1)
)


@pytest.mark.parametrize(
    ("enabled", "evaluated_ago", "failed_ago", "queued", "expected"),
    [
        (False, timedelta(seconds=5), timedelta(seconds=1), _WAITING_LONG, "DISABLED"),
        (True, timedelta(minutes=5), timedelta(seconds=1), _WAITING_LONG, "ERROR"),
        # Its own oldest queued evaluation, a retry, has waited an hour.
        (True, timedelta(seconds=5), None, _WAITING_LONG, "DEGRADED"),
        (True, timedelta(seconds=5), timedelta(minutes=5), _WAITING_BRIEFLY, "RUNNING"),
        (True, None, None, _WAITING_BRIEFLY, "QUEUED"),
        (True, None, None, QueuedWork(), "NEVER_RUN"),
    ],
)
def test_project_evaluator_run_status_precedence(
    enabled: bool,
    evaluated_ago: Optional[timedelta],
    failed_ago: Optional[timedelta],
    queued: QueuedWork,
    expected: ProjectEvaluatorRunStatus,
) -> None:
    now = datetime.now(timezone.utc)
    status = project_evaluator_run_status(
        enabled=enabled,
        last_evaluated_at=None if evaluated_ago is None else now - evaluated_ago,
        last_failed_at=None if failed_ago is None else now - failed_ago,
        queued=queued,
        now=now,
    )
    assert status == expected
