from asyncio import sleep
from datetime import datetime, timedelta, timezone
from queue import SimpleQueue
from unittest.mock import MagicMock

from sqlalchemy import event, select
from sqlalchemy.engine import Engine

from phoenix.db import models
from phoenix.db.bulk_inserter import BulkInserter
from phoenix.db.insertion.project_session import advance_project_session_liveness
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode


def _span(*, trace_id: str, span_id: str, session_id: str) -> Span:
    start_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return Span(
        name="session-span",
        context=SpanContext(trace_id=trace_id, span_id=span_id),
        span_kind=SpanKind.CHAIN,
        parent_id=None,
        start_time=start_time,
        end_time=start_time + timedelta(seconds=1),
        status_code=SpanStatusCode.OK,
        status_message="",
        attributes={"session": {"id": session_id}},
        events=[],
        conversation=None,
    )


async def test_span_batch_coalesces_session_liveness_and_ignores_duplicates(
    db: DbSessionFactory,
) -> None:
    trace_id = "1" * 32
    session_id = "session-batch"
    spans = [
        _span(trace_id=trace_id, span_id=f"{index:016x}", session_id=session_id)
        for index in range(1, 4)
    ]
    inserter = BulkInserter(
        db,
        event_queue=SimpleQueue(),
        span_cost_calculator=MagicMock(),
        initial_batch_of_spans=[(span, "project") for span in spans],
    )
    liveness_updates: list[str] = []

    def _capture_liveness_update(
        _conn: object,
        _cursor: object,
        statement: str,
        _parameters: object,
        _context: object,
        _executemany: bool,
    ) -> None:
        if "update project_sessions set last_span_seen_at" in statement.lower():
            liveness_updates.append(statement)

    event.listen(Engine, "before_cursor_execute", _capture_liveness_update)
    try:
        await inserter._insert_spans(len(spans))
    finally:
        event.remove(Engine, "before_cursor_execute", _capture_liveness_update)

    assert len(liveness_updates) == 1
    async with db() as session:
        project_session = await session.scalar(
            select(models.ProjectSession).where(models.ProjectSession.session_id == session_id)
        )
        assert project_session is not None
        first_seen_at = project_session.last_span_seen_at

    inserter._spans.append((spans[0], "project"))
    await inserter._insert_spans(1)
    async with db() as session:
        duplicate_seen_at = await session.scalar(
            select(models.ProjectSession.last_span_seen_at).where(
                models.ProjectSession.session_id == session_id
            )
        )
    assert duplicate_seen_at == first_seen_at

    await sleep(0.01)
    inserter._spans.append(
        (_span(trace_id=trace_id, span_id="4" * 16, session_id=session_id), "project")
    )
    await inserter._insert_spans(1)
    async with db() as session:
        next_seen_at = await session.scalar(
            select(models.ProjectSession.last_span_seen_at).where(
                models.ProjectSession.session_id == session_id
            )
        )
    assert next_seen_at is not None
    assert next_seen_at > first_seen_at


async def test_session_liveness_update_is_monotonic(db: DbSessionFactory) -> None:
    initial_seen_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    newer_seen_at = initial_seen_at + timedelta(minutes=2)
    older_seen_at = initial_seen_at + timedelta(minutes=1)
    async with db() as session:
        project = models.Project(name="monotonic-liveness")
        session.add(project)
        await session.flush()
        project_session = models.ProjectSession(
            session_id="monotonic-liveness",
            project_id=project.id,
            start_time=initial_seen_at,
            end_time=initial_seen_at,
            last_span_seen_at=initial_seen_at,
        )
        session.add(project_session)
        await session.flush()
        project_session_id = project_session.id
        await advance_project_session_liveness(session, [project_session_id], seen_at=newer_seen_at)
        await advance_project_session_liveness(session, [project_session_id], seen_at=older_seen_at)

    async with db() as session:
        last_span_seen_at = await session.scalar(
            select(models.ProjectSession.last_span_seen_at).where(
                models.ProjectSession.id == project_session_id
            )
        )
    assert last_span_seen_at == newer_seen_at
