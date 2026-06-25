from datetime import datetime, timezone

from pydantic_ai import RunUsage
from sqlalchemy import func, select

from phoenix.db import models
from phoenix.server.api.routers.agents import (
    _build_message_metadata_chunk,
    _build_turn_complete_chunk,
    _get_span_context,
    _persist_db_traces,
)
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
        llm_token_count_prompt=0,
        llm_token_count_completion=0,
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

    assert num_traces == 1
    assert persisted_span is not None
