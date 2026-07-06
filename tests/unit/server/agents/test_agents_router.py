import warnings
from datetime import datetime, timezone

import pytest
from pydantic_ai import RunUsage
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SAWarning

import phoenix.server.api.routers.agents as agents_router
from phoenix.db import models
from phoenix.server.api.routers.agents import (
    _build_message_metadata_chunk,
    _build_turn_complete_chunk,
    _get_span_context,
    _persist_backend_traces_with_retry,
    _persist_db_traces,
)
from phoenix.server.dml_event import DmlEvent, SpanInsertEvent
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import extract_otel_context


def test_message_metadata_can_use_propagated_root_span_context() -> None:
    trace_id = "931b2fbce00d0b18834637856fa72c7e"
    root_span_id = "f66a81825e150dc1"
    parent_context = extract_otel_context({"traceparent": f"00-{trace_id}-{root_span_id}-01"})

    metadata_chunk = _build_message_metadata_chunk(
        span_context=_get_span_context(parent_context),
        session_id="session-1",
        usage=RunUsage(input_tokens=1, output_tokens=2),
    )

    metadata = metadata_chunk.message_metadata
    assert metadata is not None
    assert metadata.trace is not None
    assert metadata.trace.trace_id == trace_id
    assert metadata.trace.root_span_id == root_span_id


def test_turn_complete_chunk_is_vercel_custom_data_part() -> None:
    trace_id = "931b2fbce00d0b18834637856fa72c7e"
    root_span_id = "f66a81825e150dc1"
    parent_context = extract_otel_context({"traceparent": f"00-{trace_id}-{root_span_id}-01"})

    chunk = _build_turn_complete_chunk(
        span_context=_get_span_context(parent_context),
        session_id="session-1",
        backend_trace_flushed=True,
    )

    assert chunk.type == "data-pxi-turn-complete"
    assert chunk.transient is True
    assert chunk.data == {
        "sessionId": "session-1",
        "trace": {"traceId": trace_id, "rootSpanId": root_span_id},
        "backendTraceFlushed": True,
    }


async def test_persist_db_traces_merges_existing_browser_trace(db: DbSessionFactory) -> None:
    trace_id = "541221e156495558c48e177a21f84891"
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        project = models.Project(name="pxi_dev")
        session.add(project)
        await session.flush()
        project_id = project.id
        existing_trace = models.Trace(
            project_rowid=project_id,
            trace_id=trace_id,
            start_time=now,
            end_time=now,
        )
        browser_span = models.Span(
            span_id="browser-root-span",
            parent_id=None,
            name="pxi.turn",
            span_kind="AGENT",
            start_time=now,
            end_time=now,
            attributes={},
            events=[],
            status_code="OK",
            status_message="",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
            llm_token_count_prompt=0,
            llm_token_count_completion=0,
        )
        existing_trace.spans = [browser_span]
        session.add(existing_trace)

    backend_span = models.Span(
        span_id="backend-span-1",
        parent_id="browser-root-span",
        name="gpt-5.4-mini",
        span_kind="LLM",
        start_time=now,
        end_time=now,
        attributes={},
        events=[],
        status_code="OK",
        status_message="",
        cumulative_error_count=0,
        cumulative_llm_token_count_prompt=0,
        cumulative_llm_token_count_completion=0,
        llm_token_count_prompt=3,
        llm_token_count_completion=5,
    )
    backend_trace = models.Trace(
        project_rowid=project_id,
        trace_id=trace_id,
        start_time=now,
        end_time=now,
        spans=[backend_span],
        span_costs=[],
    )

    async with db() as session:
        await _persist_db_traces(session=session, db_traces=[backend_trace])
        await session.flush()

        num_traces = await session.scalar(
            select(func.count()).select_from(models.Trace).where(models.Trace.trace_id == trace_id)
        )
        persisted_span = await session.scalar(
            select(models.Span).where(models.Span.span_id == "backend-span-1")
        )
        persisted_browser_span = await session.scalar(
            select(models.Span).where(models.Span.span_id == "browser-root-span")
        )

    assert num_traces == 1
    assert persisted_span is not None
    assert persisted_browser_span is not None
    assert persisted_browser_span.cumulative_llm_token_count_prompt == 3
    assert persisted_browser_span.cumulative_llm_token_count_completion == 5


async def test_persist_db_traces_merge_with_session_does_not_warn(db: DbSessionFactory) -> None:
    """Merging backend spans into an ingested browser trace must not associate
    transient Trace objects with the persistent ProjectSession, which triggers
    SAWarning: "Object of type <Trace> not in session, add operation along
    'ProjectSession.traces' will not proceed" on every autoflush."""
    trace_id = "cc1221e156495558c48e177a21f84891"
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        project = models.Project(name="pxi_dev")
        session.add(project)
        await session.flush()
        project_id = project.id
        existing_trace = models.Trace(
            project_rowid=project_id,
            trace_id=trace_id,
            start_time=now,
            end_time=now,
        )
        session.add(existing_trace)

    backend_trace = _build_backend_trace(
        project_id=project_id, trace_id=trace_id, span_id="span-session-1"
    )
    backend_trace.project_session = models.ProjectSession(
        session_id="pxi-session-1",
        project_id=project_id,
        start_time=now,
        end_time=now,
    )

    with warnings.catch_warnings():
        warnings.simplefilter("error", SAWarning)
        async with db() as session:
            await _persist_db_traces(session=session, db_traces=[backend_trace])
            await session.flush()

    async with db() as session:
        persisted_trace = await session.scalar(
            select(models.Trace).where(models.Trace.trace_id == trace_id)
        )
        assert persisted_trace is not None
        project_session = await session.scalar(
            select(models.ProjectSession).where(models.ProjectSession.session_id == "pxi-session-1")
        )
        assert project_session is not None
        assert persisted_trace.project_session_rowid == project_session.id


class _FakeEventQueue:
    def __init__(self) -> None:
        self.events: list[DmlEvent] = []

    def put(self, item: DmlEvent) -> None:
        self.events.append(item)


def _build_backend_trace(*, project_id: int, trace_id: str, span_id: str) -> models.Trace:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    backend_span = models.Span(
        span_id=span_id,
        parent_id=None,
        name="pxi.turn",
        span_kind="AGENT",
        start_time=now,
        end_time=now,
        attributes={},
        events=[],
        status_code="OK",
        status_message="",
        cumulative_error_count=0,
        cumulative_llm_token_count_prompt=0,
        cumulative_llm_token_count_completion=0,
        llm_token_count_prompt=0,
        llm_token_count_completion=0,
    )
    return models.Trace(
        project_rowid=project_id,
        trace_id=trace_id,
        start_time=now,
        end_time=now,
        spans=[backend_span],
        span_costs=[],
    )


async def test_persist_backend_traces_retries_on_concurrent_insert_race(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    trace_id = "aa1221e156495558c48e177a21f84891"
    async with db() as session:
        project = models.Project(name="pxi_dev")
        session.add(project)
        await session.flush()
        project_id = project.id

    persist_attempts = 0
    real_persist_db_traces = agents_router._persist_db_traces

    async def persist_failing_once(
        *, session: object, db_traces: list[models.Trace]
    ) -> tuple[int, ...]:
        nonlocal persist_attempts
        persist_attempts += 1
        if persist_attempts == 1:
            raise IntegrityError("INSERT INTO traces", {}, Exception("duplicate key"))
        return await real_persist_db_traces(session=session, db_traces=db_traces)  # type: ignore[arg-type]

    monkeypatch.setattr(agents_router, "_persist_db_traces", persist_failing_once)
    event_queue = _FakeEventQueue()

    await _persist_backend_traces_with_retry(
        db=db,
        event_queue=event_queue,
        get_db_traces=lambda: [
            _build_backend_trace(project_id=project_id, trace_id=trace_id, span_id="span-1")
        ],
    )

    assert persist_attempts == 2
    assert event_queue.events == [SpanInsertEvent((project_id,))]
    async with db() as session:
        num_traces = await session.scalar(
            select(func.count()).select_from(models.Trace).where(models.Trace.trace_id == trace_id)
        )
    assert num_traces == 1


async def test_persist_backend_traces_raises_after_exhausting_retries(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = models.Project(name="pxi_dev")
        session.add(project)
        await session.flush()
        project_id = project.id

    async def persist_always_failing(
        *, session: object, db_traces: list[models.Trace]
    ) -> tuple[int, ...]:
        raise IntegrityError("INSERT INTO traces", {}, Exception("duplicate key"))

    monkeypatch.setattr(agents_router, "_persist_db_traces", persist_always_failing)
    event_queue = _FakeEventQueue()

    with pytest.raises(IntegrityError):
        await _persist_backend_traces_with_retry(
            db=db,
            event_queue=event_queue,
            get_db_traces=lambda: [
                _build_backend_trace(
                    project_id=project_id,
                    trace_id="bb1221e156495558c48e177a21f84891",
                    span_id="span-2",
                )
            ],
        )
    assert event_queue.events == []
