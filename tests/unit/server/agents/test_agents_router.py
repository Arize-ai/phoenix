"""Behavioral tests for the agents router.

Tests cover both router-level helpers and observable behavior through the
public chat route. The LLM is the only mocked seam in behavioral tests.
"""

import json
import warnings
from collections.abc import AsyncIterator
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi import FastAPI
from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.sdk.trace import TracerProvider
from pydantic_ai import RunUsage
from pydantic_ai.messages import ModelMessage, ModelResponse, ToolCallPart, ToolReturnPart
from pydantic_ai.models.function import AgentInfo, DeltaToolCall, DeltaToolCalls, FunctionModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.ui.vercel_ai.response_types import (
    BaseChunk,
    DataChunk,
    FinishChunk,
    FinishStepChunk,
    MessageMetadataChunk,
    StartChunk,
    StartStepChunk,
    TextDeltaChunk,
    TextEndChunk,
    TextStartChunk,
)
from sqlalchemy import func, select
from sqlalchemy.exc import SAWarning
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import get_env_phoenix_agents_assistant_project_name
from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage, TurnTraceContext, UIMessage
from phoenix.server.agents.data_stream_protocol import (
    accumulate_ui_message_chunks_to_ui_messages,
)
from phoenix.server.agents.pydantic_ai import OpenInferenceModelWrapper
from phoenix.server.api.routers.agents import (
    _build_message_metadata_chunk,
    _emit_turn_root_span,
    _get_span_context,
    _persist_db_traces,
    _resolve_turn_trace_ids,
    _synthesize_client_tool_spans,
    _turn_parent_context,
)
from phoenix.server.settings.registry import AgentTraceRecordingSetting
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer, extract_otel_context

_BUILD_MODEL_PATCH_TARGET = "phoenix.server.api.routers.agents.build_model"


def _user_message(text: str, *, message_id: str = "msg-user-1") -> dict[str, Any]:
    return {
        "id": message_id,
        "role": "user",
        "parts": [{"type": "text", "text": text}],
    }


def _chat_url(session_id: str) -> str:
    return f"/agents/assistant/sessions/{session_id}/chat"


def _chat_body(
    session_id: str,
    messages: list[dict[str, Any]],
    **overrides: Any,
) -> dict[str, Any]:
    return {
        "trigger": "submit-message",
        "id": session_id,
        "messages": messages,
        "model": {
            "providerType": "builtin",
            "provider": "OPENAI",
            "modelName": "gpt-test",
        },
        **overrides,
    }


def _stream_chunks(response_text: str) -> list[dict[str, Any]]:
    """Parse the Vercel AI SSE data stream into its JSON chunks."""
    chunks = []
    for line in response_text.splitlines():
        if line.startswith("data: ") and line != "data: [DONE]":
            chunks.append(json.loads(line[len("data: ") :]))
    return chunks


async def _accumulate_streamed_assistant_message(
    chunks: list[dict[str, Any]],
) -> dict[str, Any]:
    chunk_types: dict[str, type[BaseChunk]] = {
        "finish": FinishChunk,
        "finish-step": FinishStepChunk,
        "message-metadata": MessageMetadataChunk,
        "start": StartChunk,
        "start-step": StartStepChunk,
        "text-delta": TextDeltaChunk,
        "text-end": TextEndChunk,
        "text-start": TextStartChunk,
    }

    async def _iter_chunks() -> AsyncIterator[BaseChunk]:
        for chunk in chunks:
            chunk_type = chunk["type"]
            model = DataChunk if chunk_type.startswith("data-") else chunk_types.get(chunk_type)
            if model is not None:
                yield model.model_validate(chunk)

    latest_message: UIMessage | None = None
    async for message in accumulate_ui_message_chunks_to_ui_messages(_iter_chunks()):
        latest_message = message
    assert latest_message is not None
    return latest_message.model_dump(mode="json", by_alias=True, exclude_none=True)


async def _load_session_messages(
    session: AsyncSession,
    session_id: str,
) -> list[dict[str, Any]]:
    messages = (
        await session.scalars(
            select(models.AgentSessionMessage.message)
            .join(models.AgentSession)
            .where(models.AgentSession.session_id == session_id)
            .order_by(models.AgentSessionMessage.position)
        )
    ).all()
    return [
        message.model_dump(mode="json", by_alias=True, exclude_none=True) for message in messages
    ]


def _scripted_model(
    *,
    bash_command: str | None = None,
    summary: str | None = "Scripted title",
) -> FunctionModel:
    """A model double for a single chat turn.

    The streamed chat run calls the ``bash`` tool once with ``bash_command``
    (when provided) and then replies with text. The non-streamed request made
    by session-title summarization calls the ``summary`` output tool, or raises
    when ``summary`` is None to simulate a summarization failure.
    """

    async def stream_function(
        messages: list[ModelMessage],
        agent_info: AgentInfo,
    ) -> AsyncIterator[str | DeltaToolCalls]:
        # Only the turn's own tool round matters: earlier turns' bash calls
        # are already in the history, so inspect just the latest message.
        already_ran_bash_this_turn = any(
            isinstance(part, ToolReturnPart) and part.tool_name == "bash"
            for part in messages[-1].parts
        )
        if bash_command is not None and not already_ran_bash_this_turn:
            yield {
                1: DeltaToolCall(
                    name="bash",
                    json_args=json.dumps({"summary": "run a command", "command": bash_command}),
                )
            }
        else:
            yield "done"

    def function(messages: list[ModelMessage], agent_info: AgentInfo) -> ModelResponse:
        if summary is None:
            raise RuntimeError("summarization model is down")
        return ModelResponse(parts=[ToolCallPart(tool_name="summary", args={"summary": summary})])

    return FunctionModel(function=function, stream_function=stream_function)


def _mock_turn_models(monkeypatch: pytest.MonkeyPatch, *turn_models: FunctionModel) -> None:
    """Serve one scripted model per chat turn, in order."""
    remaining_models = iter(turn_models)

    async def _fake_build_model(*args: object, **kwargs: object) -> FunctionModel:
        return next(remaining_models)

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)


async def test_chat_turn_persists_session_transcript(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A full chat turn writes the agent_sessions row whose transcript
    contains the incoming history plus the streamed assistant reply (with
    turn metadata), assembled entirely server-side."""

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "44444444-4444-4444-8444-444444444444"
    body = _chat_body(session_id, [_user_message("What datasets exist?")])

    response = await httpx_client.post(_chat_url(session_id), json=body)
    assert response.status_code == 200
    chunks = _stream_chunks(response.text)
    created_chunks = [chunk for chunk in chunks if chunk.get("type") == "data-session-created"]
    assert len(created_chunks) == 1
    assert created_chunks[0]["transient"] is True
    assert created_chunks[0]["data"]["sessionId"] == session_id
    assert created_chunks[0]["data"]["id"]
    chunk_types = [chunk.get("type") for chunk in chunks]
    assert chunk_types.index("start") < chunk_types.index("data-session-created")
    assert chunk_types.index("data-session-created") < chunk_types.index("finish")
    # A new session's first turn streams the LLM session title as a transient
    # data chunk (TestModel fills the summary tool with generated args: "a").
    assert "data-session-summary" in response.text

    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        assert agent_session.session_id == session_id
        assert agent_session.user_id is None
        # The in-stream summary is persisted as the session title.
        assert agent_session.title == "a"
        messages = await _load_session_messages(session, session_id)
        # No bash command this turn, so no shell-state snapshot row.
        assert await session.scalar(select(models.AgentSessionSnapshot)) is None

    assert messages[0]["role"] == "user"
    assistant_messages = [message for message in messages if message["role"] == "assistant"]
    assert assistant_messages
    assert assistant_messages[-1] == await _accumulate_streamed_assistant_message(chunks)
    metadata = assistant_messages[-1]["metadata"]
    assert metadata["sessionId"] == session_id
    assert metadata["usage"]["tokens"]["total"] > 0
    # Resuming a session sends the persisted transcript back through the chat
    # request's message validation, so every stored message must round-trip.
    for message in messages:
        PhoenixUIMessage.model_validate(message)

    second_response = await httpx_client.post(
        _chat_url(session_id),
        json={
            **body,
            "messages": [
                *messages,
                _user_message("And experiments?", message_id="msg-user-2"),
            ],
        },
    )
    assert second_response.status_code == 200
    # The persisted-session acknowledgement is idempotent so a retry can
    # reconcile Relay even if the first stream disconnected before receiving it.
    assert "data-session-created" in second_response.text
    # Only a session's first turn summarizes; later turns keep the stored title.
    assert "data-session-summary" not in second_response.text
    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        assert agent_session.title == "a"


def test_message_metadata_can_use_propagated_root_span_context() -> None:
    trace_id = "931b2fbce00d0b18834637856fa72c7e"
    root_span_id = "f66a81825e150dc1"
    parent_context = extract_otel_context({"traceparent": f"00-{trace_id}-{root_span_id}-01"})

    metadata_chunk = _build_message_metadata_chunk(
        span_context=_get_span_context(parent_context),
        turn_trace_context=None,
        session_id="session-1",
        usage=RunUsage(input_tokens=1, output_tokens=2),
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
        usage=RunUsage(),
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
    """Every span in a backend batch is retained while merging into a trace."""
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
    trace_id = "cc1221e156495558c48e177a21f84891"
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


async def test_chat_stream_metadata_uses_turn_trace_context(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The streamed and persisted assistant metadata use the browser's turn ids."""
    trace_id = "931b2fbce00d0b18834637856fa72c7e"
    root_span_id = "f66a81825e150dc1"

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "11111111-1111-4111-8111-111111111111"

    response = await httpx_client.post(
        _chat_url(session_id),
        json=_chat_body(
            session_id,
            [_user_message("hello")],
            turnTraceContext={
                "traceId": trace_id,
                "rootSpanId": root_span_id,
                "startedAt": datetime.now(timezone.utc).isoformat(),
            },
        ),
    )
    assert response.status_code == 200

    # The stream carries pydantic-ai's own metadata chunk too; the Phoenix one
    # is identified by its sessionId payload.
    phoenix_metadata_chunks = [
        chunk["messageMetadata"]
        for chunk in _stream_chunks(response.text)
        if chunk.get("type") == "message-metadata" and "sessionId" in chunk["messageMetadata"]
    ]
    assert len(phoenix_metadata_chunks) == 1
    assert phoenix_metadata_chunks[0]["trace"] == {
        "traceId": trace_id,
        "rootSpanId": root_span_id,
    }

    async with db() as session:
        stored_messages = await _load_session_messages(session, session_id)
    assistant_messages = [message for message in stored_messages if message["role"] == "assistant"]
    assert assistant_messages
    assert assistant_messages[-1]["metadata"]["trace"] == {
        "traceId": trace_id,
        "rootSpanId": root_span_id,
    }


async def test_chat_turn_without_messages_persists_no_session(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A turn that produces no transcript (empty message history) must not
    leave behind an empty agent_sessions row."""

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "22222222-2222-4222-8222-222222222222"

    await httpx_client.post(_chat_url(session_id), json=_chat_body(session_id, []))

    async with db() as session:
        assert (await session.scalars(select(models.AgentSession))).all() == []


async def test_failed_summary_leaves_session_untitled_until_a_later_turn(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failed first-turn summarization still persists the transcript but
    leaves the session untitled; the next turn retries summarization and the
    non-empty title then wins over the stored empty one."""
    session_id = "33333333-3333-4333-8333-333333333333"
    _mock_turn_models(
        monkeypatch,
        _scripted_model(summary=None),
        _scripted_model(summary="Second-turn title"),
    )

    first_response = await httpx_client.post(
        _chat_url(session_id),
        json=_chat_body(session_id, [_user_message("first question")]),
    )
    assert first_response.status_code == 200
    assert "data-session-summary" not in first_response.text
    async with db() as session:
        agent_sessions = (await session.scalars(select(models.AgentSession))).all()
        assert len(agent_sessions) == 1
        assert agent_sessions[0].title == ""
        stored_messages = await _load_session_messages(session, session_id)
        assert stored_messages

    second_response = await httpx_client.post(
        _chat_url(session_id),
        json=_chat_body(
            session_id,
            [*stored_messages, _user_message("second question", message_id="msg-user-2")],
        ),
    )
    assert second_response.status_code == 200
    # The session is still untitled, so the second turn summarizes again.
    summary_chunks = [
        chunk
        for chunk in _stream_chunks(second_response.text)
        if chunk.get("type") == "data-session-summary"
    ]
    assert [chunk["data"] for chunk in summary_chunks] == ["Second-turn title"]
    async with db() as session:
        agent_sessions = (await session.scalars(select(models.AgentSession))).all()
        assert len(agent_sessions) == 1
        assert agent_sessions[0].title == "Second-turn title"
        assert len(await _load_session_messages(session, session_id)) > len(stored_messages)


async def test_bash_shell_state_persists_across_chat_turns(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Shell state written by a bash command in one turn survives to later
    turns: the snapshot is persisted, left intact by turns without bash
    activity, and restored into the next turn's shell."""
    session_id = "55555555-5555-4555-8555-555555555555"
    note_path = "/home/user/workspace/note.txt"
    _mock_turn_models(
        monkeypatch,
        _scripted_model(bash_command=f"echo hello > {note_path}"),
        _scripted_model(bash_command=None),
        _scripted_model(bash_command=f"cat {note_path}"),
    )

    first_response = await httpx_client.post(
        _chat_url(session_id),
        json=_chat_body(session_id, [_user_message("write a note")]),
    )
    assert first_response.status_code == 200
    first_chunks = _stream_chunks(first_response.text)
    async with db() as session:
        snapshots = (await session.scalars(select(models.AgentSessionSnapshot))).all()
        assert len(snapshots) == 1
        first_snapshot = snapshots[0].bashkit_state
        assert first_snapshot
        stored_messages = await _load_session_messages(session, session_id)

    assistant_messages = [message for message in stored_messages if message["role"] == "assistant"]
    assert len(assistant_messages) == 1
    part_types = [part["type"] for part in assistant_messages[0]["parts"]]
    assert "tool-bash" in part_types
    assert "text" in part_types
    assert part_types.count("step-start") == sum(
        chunk.get("type") == "start-step" for chunk in first_chunks
    )

    second_response = await httpx_client.post(
        _chat_url(session_id),
        json=_chat_body(
            session_id,
            [*stored_messages, _user_message("thanks", message_id="msg-user-2")],
        ),
    )
    assert second_response.status_code == 200
    async with db() as session:
        # A turn without bash activity leaves the stored shell state intact.
        snapshots = (await session.scalars(select(models.AgentSessionSnapshot))).all()
        assert len(snapshots) == 1
        assert snapshots[0].bashkit_state == first_snapshot
        stored_messages = await _load_session_messages(session, session_id)

    third_response = await httpx_client.post(
        _chat_url(session_id),
        json=_chat_body(
            session_id,
            [*stored_messages, _user_message("read it back", message_id="msg-user-3")],
        ),
    )
    assert third_response.status_code == 200
    # The third turn's shell was restored from the persisted snapshot, so the
    # file written in the first turn is still there.
    bash_outputs = [
        chunk["output"]
        for chunk in _stream_chunks(third_response.text)
        if chunk.get("type") == "tool-output-available" and "output" in chunk
    ]
    assert any(output.get("stdout") == "hello\n" for output in bash_outputs)
    async with db() as session:
        # A turn with bash activity overwrites the session's single snapshot
        # row in place rather than accumulating rows.
        snapshots = (await session.scalars(select(models.AgentSessionSnapshot))).all()
        assert len(snapshots) == 1


# ---------------------------------------------------------------------------
# Trace ingestion
# ---------------------------------------------------------------------------


_BROWSER_TRACE_ID = "541221e156495558c48e177a21f84891"
_BROWSER_ROOT_SPAN_ID = "3789d49049f9d108"
_BROWSER_TURN_TIME = datetime(2026, 1, 1, tzinfo=timezone.utc)


async def _enable_local_trace_recording(app: FastAPI) -> None:
    await app.state.system_settings.update_agent_trace_recording(
        AgentTraceRecordingSetting(allow_local_traces=True)
    )


async def _ingest_browser_trace(db: DbSessionFactory) -> None:
    """Simulate the browser having already ingested the turn's root span."""
    async with db() as session:
        project = models.Project(name=get_env_phoenix_agents_assistant_project_name())
        session.add(project)
        await session.flush()
        browser_trace = models.Trace(
            project_rowid=project.id,
            trace_id=_BROWSER_TRACE_ID,
            start_time=_BROWSER_TURN_TIME,
            end_time=_BROWSER_TURN_TIME,
        )
        browser_trace.spans = [
            models.Span(
                span_id=_BROWSER_ROOT_SPAN_ID,
                parent_id=None,
                name="pxi.turn",
                span_kind="AGENT",
                start_time=_BROWSER_TURN_TIME,
                end_time=_BROWSER_TURN_TIME,
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
        ]
        session.add(browser_trace)


def _mock_traced_test_model(monkeypatch: pytest.MonkeyPatch) -> None:
    """Mirror ``build_model``'s OpenInference wrapping so the turn's model
    calls are recorded as LLM spans by the route's tracer."""

    async def _fake_build_model(
        *args: object,
        tracer_provider: TracerProvider | None = None,
        **kwargs: object,
    ) -> OpenInferenceModelWrapper:
        provider = tracer_provider if tracer_provider is not None else TracerProvider()
        tracer = OITracer(provider.get_tracer(__name__), config=TraceConfig())
        return OpenInferenceModelWrapper(TestModel(call_tools=[]), tracer=tracer)

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)


async def _post_traced_chat_turn(
    httpx_client: httpx.AsyncClient,
    session_id: str,
) -> httpx.Response:
    return await httpx_client.post(
        _chat_url(session_id),
        json=_chat_body(
            session_id,
            [_user_message("What datasets exist?")],
            ingestTraces=True,
            turnTraceContext={
                "traceId": _BROWSER_TRACE_ID,
                "rootSpanId": _BROWSER_ROOT_SPAN_ID,
                "startedAt": _BROWSER_TURN_TIME.isoformat(),
            },
        ),
    )


async def test_chat_turn_trace_ingestion_merges_backend_spans_into_browser_trace(
    db: DbSessionFactory,
    app: FastAPI,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With trace ingestion enabled and the browser's turn context propagated,
    the turn's backend spans land in the browser's existing trace: no duplicate
    trace row, every span in the batch persisted under the browser root, the
    trace's time range widened, and the root's cumulative token counts updated."""
    await _enable_local_trace_recording(app)
    await _ingest_browser_trace(db)
    _mock_traced_test_model(monkeypatch)
    session_id = "66666666-6666-4666-8666-666666666666"

    response = await _post_traced_chat_turn(httpx_client, session_id)
    assert response.status_code == 200

    async with db() as session:
        traces = (
            await session.scalars(
                select(models.Trace).where(models.Trace.trace_id == _BROWSER_TRACE_ID)
            )
        ).all()
        assert len(traces) == 1
        merged_trace = traces[0]
        spans = (
            await session.scalars(
                select(models.Span)
                .join(models.Trace)
                .where(models.Trace.trace_id == _BROWSER_TRACE_ID)
            )
        ).all()

    backend_spans = [span for span in spans if span.span_id != _BROWSER_ROOT_SPAN_ID]
    # The first turn records both the chat request and the session-title
    # summarization as LLM spans; both must survive the merge (a prior
    # regression dropped every other span in the batch).
    assert len(backend_spans) >= 2
    assert all(span.parent_id == _BROWSER_ROOT_SPAN_ID for span in backend_spans)
    assert all(span.span_kind == "LLM" for span in backend_spans)

    browser_root_span = next(span for span in spans if span.span_id == _BROWSER_ROOT_SPAN_ID)
    total_root_tokens = (
        browser_root_span.cumulative_llm_token_count_prompt
        + browser_root_span.cumulative_llm_token_count_completion
    )
    assert total_root_tokens > 0

    assert merged_trace.start_time == _BROWSER_TURN_TIME
    assert merged_trace.end_time > _BROWSER_TURN_TIME


async def test_chat_turn_trace_ingestion_links_project_session_without_orm_warnings(
    db: DbSessionFactory,
    app: FastAPI,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Merging backend spans into a browser-ingested trace groups the trace
    under a project session keyed by the chat session id, without tripping
    SQLAlchemy's transient-object relationship warnings on autoflush."""
    await _enable_local_trace_recording(app)
    await _ingest_browser_trace(db)
    _mock_traced_test_model(monkeypatch)
    session_id = "77777777-7777-4777-8777-777777777777"

    with warnings.catch_warnings():
        warnings.simplefilter("error", SAWarning)
        response = await _post_traced_chat_turn(httpx_client, session_id)
        assert response.status_code == 200

    async with db() as session:
        project_session = await session.scalar(
            select(models.ProjectSession).where(models.ProjectSession.session_id == session_id)
        )
        assert project_session is not None
        merged_trace = await session.scalar(
            select(models.Trace).where(models.Trace.trace_id == _BROWSER_TRACE_ID)
        )
        assert merged_trace is not None
        assert merged_trace.project_session_rowid == project_session.id
