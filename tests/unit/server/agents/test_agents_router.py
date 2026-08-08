import warnings
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from pydantic_ai.ui.vercel_ai.request_types import UIMessage
from pydantic_ai.usage import RequestUsage
from sqlalchemy import func, select
from sqlalchemy.exc import SAWarning

from phoenix.db import models
from phoenix.server.api.routers.agents import (
    TurnTraceContext,
    _build_message_metadata_chunk,
    _emit_turn_root_span,
    _get_span_context,
    _persist_db_traces,
    _resolve_turn_trace_ids,
    _synthesize_client_tool_spans,
    _turn_parent_context,
)
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer, extract_otel_context


def test_message_metadata_can_use_propagated_root_span_context() -> None:
    trace_id = "931b2fbce00d0b18834637856fa72c7e"
    root_span_id = "f66a81825e150dc1"
    parent_context = extract_otel_context({"traceparent": f"00-{trace_id}-{root_span_id}-01"})

    metadata_chunk = _build_message_metadata_chunk(
        span_context=_get_span_context(parent_context),
        turn_trace_context=None,
        session_id="session-1",
        usage=RequestUsage(input_tokens=1, output_tokens=2),
    )

    metadata = metadata_chunk.message_metadata
    assert metadata is not None
    assert metadata.trace is not None
    assert metadata.trace.trace_id == trace_id
    assert metadata.trace.root_span_id == root_span_id


def test_turn_trace_context_is_clamped_and_used_for_metadata() -> None:
    now = datetime(2026, 7, 10, 12, tzinfo=timezone.utc)
    turn_trace_context = TurnTraceContext(
        trace_id="1" * 32,
        root_span_id="2" * 16,
        started_at=now - timedelta(days=3),
    )
    turn_ids = _resolve_turn_trace_ids(turn_trace_context, now=now)
    assert turn_ids.started_at == now - timedelta(hours=24)
    span_context = _get_span_context(_turn_parent_context(turn_ids))
    assert span_context is not None
    assert span_context.trace_id == int("1" * 32, 16)

    metadata = _build_message_metadata_chunk(
        span_context=None,
        turn_trace_context=turn_trace_context,
        session_id="session-1",
        usage=RequestUsage(),
    ).message_metadata
    assert metadata is not None
    assert metadata.turn_trace_context == turn_trace_context
    assert metadata.trace is not None
    assert metadata.trace.trace_id == turn_trace_context.trace_id
    assert metadata.trace.root_span_id == turn_trace_context.root_span_id


def test_zero_turn_ids_are_replaced() -> None:
    now = datetime(2026, 7, 10, 12, tzinfo=timezone.utc)
    turn_ids = _resolve_turn_trace_ids(
        TurnTraceContext(trace_id="0" * 32, root_span_id="0" * 16, started_at=now),
        now=now,
    )
    assert turn_ids.trace_id != 0
    assert turn_ids.root_span_id != 0


def test_synthesizes_root_and_clamped_client_tool_span() -> None:
    now = datetime(2026, 7, 10, 12, tzinfo=timezone.utc)
    turn_trace_context = TurnTraceContext(
        trace_id="1" * 32,
        root_span_id="2" * 16,
        started_at=now,
    )
    turn_ids = _resolve_turn_trace_ids(turn_trace_context, now=now)
    tracer = Tracer(span_cost_calculator=MagicMock())
    messages = [
        UIMessage.model_validate(
            {
                "id": "user-1",
                "role": "user",
                "parts": [{"type": "text", "text": "Use the tool"}],
            }
        ),
        UIMessage.model_validate(
            {
                "id": "assistant-1",
                "role": "assistant",
                "parts": [
                    {
                        "type": "tool-open_page",
                        "toolCallId": "call-1",
                        "state": "output-available",
                        "input": {"url": "/traces"},
                        "output": {"ok": True},
                        "callProviderMetadata": {
                            "phoenix": {
                                "tool_execution_environment": "client",
                                "tool_input_emitted_at": (now + timedelta(seconds=1)).isoformat(),
                                "client_started_at": (now - timedelta(minutes=1)).isoformat(),
                                "client_ended_at": (now + timedelta(minutes=1)).isoformat(),
                            }
                        },
                    }
                ],
            }
        ),
    ]
    received_at = now + timedelta(seconds=5)

    _synthesize_client_tool_spans(
        tracer=tracer,
        turn_ids=turn_ids,
        messages=messages,
        received_at=received_at,
        session_id="session-1",
    )
    _emit_turn_root_span(
        tracer=tracer,
        turn_ids=turn_ids,
        session_id="session-1",
        input_text="Use the tool",
        output_text="Done",
        error_message=None,
        end_time=received_at,
        user_email=None,
    )

    db_traces = tracer.get_db_traces(project_id=1)
    assert len(db_traces) == 1
    spans_by_name = {span.name: span for span in db_traces[0].spans}
    root = spans_by_name["pxi.turn"]
    tool = spans_by_name["open_page"]
    assert root.span_id == turn_trace_context.root_span_id
    assert root.parent_id is None
    assert root.status_code == "OK"
    assert tool.parent_id == turn_trace_context.root_span_id
    assert tool.start_time == now + timedelta(seconds=1)
    assert tool.end_time == received_at
    assert tool.status_code == "OK"
    assert tool.attributes["tool"]["name"] == "open_page"


def test_error_parts_record_exception_events() -> None:
    now = datetime(2026, 7, 10, 12, tzinfo=timezone.utc)
    turn_trace_context = TurnTraceContext(
        trace_id="3" * 32,
        root_span_id="4" * 16,
        started_at=now,
    )
    turn_ids = _resolve_turn_trace_ids(turn_trace_context, now=now)
    tracer = Tracer(span_cost_calculator=MagicMock())
    messages = [
        UIMessage.model_validate(
            {
                "id": "user-1",
                "role": "user",
                "parts": [{"type": "text", "text": "Use the tool"}],
            }
        ),
        UIMessage.model_validate(
            {
                "id": "assistant-1",
                "role": "assistant",
                "parts": [
                    {
                        "type": "tool-open_page",
                        "toolCallId": "call-1",
                        "state": "output-error",
                        "input": {"url": "/traces"},
                        "errorText": "tool exploded",
                        "callProviderMetadata": {
                            "phoenix": {
                                "tool_execution_environment": "client",
                                "tool_input_emitted_at": (now + timedelta(seconds=1)).isoformat(),
                            }
                        },
                    }
                ],
            }
        ),
    ]
    received_at = now + timedelta(seconds=5)

    _synthesize_client_tool_spans(
        tracer=tracer,
        turn_ids=turn_ids,
        messages=messages,
        received_at=received_at,
        session_id="session-1",
    )
    _emit_turn_root_span(
        tracer=tracer,
        turn_ids=turn_ids,
        session_id="session-1",
        input_text="Use the tool",
        output_text=None,
        error_message="turn failed",
        end_time=received_at,
        user_email=None,
    )

    db_traces = tracer.get_db_traces(project_id=1)
    assert len(db_traces) == 1
    spans_by_name = {span.name: span for span in db_traces[0].spans}
    tool = spans_by_name["open_page"]
    assert tool.status_code == "ERROR"
    assert tool.events == [
        {
            "name": "exception",
            "timestamp": received_at.isoformat(),
            "attributes": {"exception.message": "tool exploded"},
        }
    ]
    root = spans_by_name["pxi.turn"]
    assert root.status_code == "ERROR"
    assert root.events == [
        {
            "name": "exception",
            "timestamp": received_at.isoformat(),
            "attributes": {"exception.message": "turn failed"},
        }
    ]


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


async def test_persist_db_traces_merge_keeps_all_spans_in_batch(db: DbSessionFactory) -> None:
    """Regression: the merge path iterated ``db_trace.spans`` while
    ``db_span.trace = existing_trace`` back-populated the same collection,
    skipping every other span. In production this dropped each follow-up
    request's ``pxi.iter.server`` span, orphaning its LLM child and rendering
    duplicate turns in the session view."""
    trace_id = "dd1221e156495558c48e177a21f84891"
    browser_root_span_id = "3789d49049f9d108"
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        project = models.Project(name="pxi_dev")
        session.add(project)
        await session.flush()
        project_id = project.id
        session.add(
            models.Trace(
                project_rowid=project_id,
                trace_id=trace_id,
                start_time=now,
                end_time=now,
            )
        )

    # Production buffer order: the LLM child ends before its parent iter span.
    batch = _build_backend_trace(
        project_id=project_id,
        trace_id=trace_id,
        spans=[
            _build_backend_span(
                span_id="llm-2", parent_id="iter-2", name="gpt-5.5", span_kind="LLM"
            ),
            _build_backend_span(
                span_id="iter-2",
                parent_id=browser_root_span_id,
                name="pxi.iter.server",
                span_kind="AGENT",
            ),
        ],
    )

    async with db() as session:
        await _persist_db_traces(session=session, db_traces=[batch])

    async with db() as session:
        span_ids = set(
            (
                await session.scalars(
                    select(models.Span.span_id)
                    .join(models.Trace)
                    .where(models.Trace.trace_id == trace_id)
                )
            ).all()
        )
    assert span_ids == {"llm-2", "iter-2"}


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


def _build_backend_span(
    *,
    span_id: str,
    parent_id: str | None = None,
    name: str = "pxi.turn",
    span_kind: str = "AGENT",
) -> models.Span:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return models.Span(
        span_id=span_id,
        parent_id=parent_id,
        name=name,
        span_kind=span_kind,
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


def _build_backend_trace(
    *,
    project_id: int,
    trace_id: str,
    span_id: str | None = None,
    spans: list[models.Span] | None = None,
) -> models.Trace:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    if spans is None:
        spans = [_build_backend_span(span_id=span_id)] if span_id is not None else []
    return models.Trace(
        project_rowid=project_id,
        trace_id=trace_id,
        start_time=now,
        end_time=now,
        spans=spans,
        span_costs=[],
    )
