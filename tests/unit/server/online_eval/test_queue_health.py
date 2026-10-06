from datetime import datetime, timedelta, timezone
from typing import Optional

import pytest

from phoenix.db import models
from phoenix.server.online_eval.queue_health import (
    ProjectEvaluatorRunStatus,
    QueuedWork,
    load_evaluation_queue,
    load_project_evaluator_queues,
    load_project_queues,
    load_queue_throughput,
    project_evaluator_run_status,
)
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_project_session, _add_span, _add_trace
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
    assert not queue.at_capacity
    # The head of the line has waited 20 minutes.
    assert queue.status == "DEGRADED"
    assert throughput.target("SPAN").evaluations_per_minute == pytest.approx(3 / 60)
    assert throughput.target("SPAN").queued_per_minute == pytest.approx(6 / 60)
    assert throughput.queued_per_minute == pytest.approx(6 / 60)


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
    project_queues = await load_project_queues(db, [project.id])
    evaluator_queues = await load_project_evaluator_queues(db, [project_evaluator_id])

    oldest_queued_at = [
        queue.target("TRACE").waiting.oldest_queued_at,
        project_queues[project.id].oldest_queued_at,
        evaluator_queues[project_evaluator_id].oldest_queued_at,
    ]
    assert oldest_queued_at == [now - timedelta(minutes=20)] * 3
    assert all(at is not None and at.tzinfo is not None for at in oldest_queued_at)
    assert queue.status == "DEGRADED"


async def test_recent_span_drops_overload_the_queue(db: DbSessionFactory) -> None:
    """A dropped span batch leaves no rows, so the queue reads span drops from the counts
    the producer keeps on the span cursor."""
    now = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    _, project_evaluator_id = await _seed_criteria(db, project.id)

    def minute(ago: timedelta) -> str:
        return (now - ago).replace(second=0, microsecond=0).isoformat()

    async with db() as session:
        session.add(
            models.EvalWorkUnit(
                span_rowid=span.id,
                project_evaluator_id=project_evaluator_id,
                created_at=now - timedelta(minutes=20),
            )
        )
        session.add(
            models.EvalSpanCursor(
                id=1,
                overflowed_counts={minute(timedelta(minutes=12)): {str(project_evaluator_id): 4}},
            )
        )
    queue = await load_evaluation_queue(db)
    assert (queue.status, queue.overflowed_count) == ("DEGRADED", 0)

    async with db() as session:
        cursor = await session.get(models.EvalSpanCursor, 1)
        assert cursor is not None
        cursor.overflowed_counts = {
            **cursor.overflowed_counts,
            minute(timedelta(minutes=5)): {str(project_evaluator_id): 3},
        }
    queue = await load_evaluation_queue(db)
    assert queue.status == "OVERLOADED"
    assert queue.overflowed_counts == {project_evaluator_id: 3}


async def test_recent_overflowed_sessions_overload_the_queue(
    db: DbSessionFactory,
) -> None:
    now = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        project_sessions = [await _add_project_session(session, project) for _ in range(3)]
    _, project_evaluator_id = await _seed_criteria(db, project.id, evaluation_target="SESSION")
    sessions = iter(project_sessions)

    def unit(status: str, *, ago: timedelta) -> models.EvalSessionWorkUnit:
        return models.EvalSessionWorkUnit(
            project_session_rowid=next(sessions).id,
            project_evaluator_id=project_evaluator_id,
            evaluated_through=now - ago,
            status=status,
            created_at=now - ago,
            updated_at=now - ago,
        )

    async with db() as session:
        session.add_all(
            [
                # Queued before the rate window, so only the overflow could move the rates.
                unit("PENDING", ago=timedelta(minutes=70)),
                unit("OVERFLOWED", ago=timedelta(minutes=12)),
            ]
        )
    queue = await load_evaluation_queue(db)
    assert (queue.status, queue.overflowed_count) == ("DEGRADED", 0)

    async with db() as session:
        session.add(unit("OVERFLOWED", ago=timedelta(minutes=5)))
    queue = await load_evaluation_queue(db)
    throughput = await load_queue_throughput(db, queue)

    assert queue.status == "OVERLOADED"
    assert queue.overflowed_counts == {project_evaluator_id: 1}
    # Never queued, so neither entered nor left the queue.
    assert (throughput.queued_per_minute, throughput.evaluations_per_minute) == (0, 0)


_WAITING_BRIEFLY = QueuedWork(queued_count=1, oldest_queued_at=datetime.now(timezone.utc))
_WAITING_LONG = QueuedWork(
    queued_count=1, oldest_queued_at=datetime.now(timezone.utc) - timedelta(hours=1)
)


@pytest.mark.parametrize(
    ("enabled", "evaluated_ago", "failed_ago", "queued", "overflowed_count", "expected"),
    [
        (False, timedelta(seconds=5), timedelta(seconds=1), _WAITING_LONG, 3, "DISABLED"),
        (True, timedelta(minutes=5), timedelta(seconds=1), _WAITING_LONG, 3, "ERROR"),
        # Its own evaluations wait too long, but some of its new ones were dropped.
        (True, timedelta(seconds=5), None, _WAITING_LONG, 3, "OVERLOADED"),
        # Its own oldest queued evaluation, a retry, has waited an hour.
        (True, timedelta(seconds=5), None, _WAITING_LONG, 0, "DEGRADED"),
        (True, timedelta(seconds=5), timedelta(minutes=5), _WAITING_BRIEFLY, 0, "RUNNING"),
        (True, None, None, _WAITING_BRIEFLY, 0, "QUEUED"),
        (True, None, None, QueuedWork(), 0, "NEVER_RUN"),
    ],
)
def test_project_evaluator_run_status_precedence(
    enabled: bool,
    evaluated_ago: Optional[timedelta],
    failed_ago: Optional[timedelta],
    queued: QueuedWork,
    overflowed_count: int,
    expected: ProjectEvaluatorRunStatus,
) -> None:
    now = datetime.now(timezone.utc)
    status = project_evaluator_run_status(
        enabled=enabled,
        last_evaluated_at=None if evaluated_ago is None else now - evaluated_ago,
        last_failed_at=None if failed_ago is None else now - failed_ago,
        queued=queued,
        overflowed_count=overflowed_count,
        now=now,
    )
    assert status == expected
