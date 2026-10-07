from datetime import datetime, timedelta, timezone
from typing import Optional

import pytest

from phoenix.db import models
from phoenix.server.online_eval.queue_health import (
    ProjectEvaluatorRunStatus,
    QueuedWork,
    load_evaluation_queue,
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
    assert not queue.at_capacity
    # The head of the line has waited 20 minutes.
    assert queue.status == "DEGRADED"
    assert throughput.target("SPAN").evaluations_per_minute == pytest.approx(3 / 60)
    assert throughput.target("SPAN").queued_per_minute == pytest.approx(6 / 60)
    assert throughput.queued_per_minute == pytest.approx(6 / 60)


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
