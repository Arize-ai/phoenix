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
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from openinference.instrumentation import OITracer, TraceConfig
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.sdk.trace import TracerProvider
from pydantic_ai import RunUsage
from pydantic_ai.messages import ModelMessage, ModelResponse, ToolCallPart, ToolReturnPart
from pydantic_ai.models.function import AgentInfo, DeltaToolCall, DeltaToolCalls, FunctionModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
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
from strawberry.relay import GlobalID

from phoenix.config import get_env_phoenix_agents_assistant_project_name
from phoenix.db import models
from phoenix.db.types.data_stream_protocol import (
    PhoenixUIMessage,
    TextUIPart,
    ToolOutputAvailablePart,
    TurnTraceContext,
    UIMessage,
)
from phoenix.server.agents.data_stream_protocol import (
    accumulate_ui_message_chunks_to_ui_messages,
)
from phoenix.server.agents.pydantic_ai import OpenInferenceModelWrapper
from phoenix.server.api.routers.agents import (
    _build_message_metadata_chunk,
    _emit_turn_root_span,
    _get_span_context,
    _merge_messages,
    _persist_db_traces,
    _resolve_turn_trace_ids,
    _synthesize_client_tool_spans,
    _turn_parent_context,
)
from phoenix.server.settings.registry import (
    AgentAssistantEnabledSetting,
    AgentTraceRecordingSetting,
)
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer, extract_otel_context

_BUILD_MODEL_PATCH_TARGET = "phoenix.server.api.routers.agents.build_model"


def _user_message(text: str, *, message_id: str = "msg-user-1") -> dict[str, Any]:
    return {
        "id": message_id,
        "role": "user",
        "parts": [{"type": "text", "text": text}],
    }


def _chat_url(agent_session_id: str) -> str:
    return f"/agents/assistant/sessions/{agent_session_id}/chat"


def _server_agent_chat_url(agent_session_id: str) -> str:
    return f"/agents/server/sessions/{agent_session_id}/chat"


def _compact_url(agent_session_id: str) -> str:
    return f"/agents/assistant/sessions/{agent_session_id}/compact"


def _compact_body() -> dict[str, Any]:
    return {
        "model": {
            "providerType": "builtin",
            "provider": "OPENAI",
            "modelName": "gpt-test",
        }
    }


def _chat_body(
    session_id: str,
    message: dict[str, Any] | None,
    **overrides: Any,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "trigger": "submit-message",
        "id": session_id,
        "model": {
            "providerType": "builtin",
            "provider": "OPENAI",
            "modelName": "gpt-test",
        },
        **overrides,
    }
    if message is not None:
        body["message"] = message
    return body


def _stream_chunks(response_text: str) -> list[dict[str, Any]]:
    """Parse the Vercel AI SSE data stream into its JSON chunks."""
    chunks = []
    for line in response_text.splitlines():
        if line.startswith("data: ") and line != "data: [DONE]":
            chunks.append(json.loads(line[len("data: ") :]))
    return chunks


async def _create_agent_session_row(
    db: DbSessionFactory,
    *,
    project_session_id: str,
    title: str = "",
    messages: list[dict[str, Any]] | None = None,
) -> str:
    """Create a persisted session the way the UI's createAgentSession mutation
    does before its first chat request, optionally seeded with a transcript."""
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id=project_session_id,
            user_id=None,
            title=title,
            project_name=get_env_phoenix_agents_assistant_project_name(),
        )
        session.add(agent_session)
        await session.flush()
        session.add_all(
            models.AgentSessionMessage(
                agent_session_id=agent_session.id,
                position=position,
                message=PhoenixUIMessage.model_validate(message),
            )
            for position, message in enumerate(messages or [])
        )
        return str(GlobalID("AgentSession", str(agent_session.id)))


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
    agent_session_rowid: int,
) -> list[dict[str, Any]]:
    messages = (
        await session.scalars(
            select(models.AgentSessionMessage.message)
            .where(models.AgentSessionMessage.agent_session_id == agent_session_rowid)
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


def _client_tool_model() -> FunctionModel:
    """Request one client tool, then finish after its result is submitted."""

    async def stream_function(
        messages: list[ModelMessage],
        agent_info: AgentInfo,
    ) -> AsyncIterator[str | DeltaToolCalls]:
        has_tool_result = any(
            isinstance(part, ToolReturnPart) and part.tool_name == "list_datasets"
            for part in messages[-1].parts
        )
        if has_tool_result:
            yield "done"
        else:
            yield {1: DeltaToolCall(name="list_datasets", json_args="{}")}

    def function(messages: list[ModelMessage], agent_info: AgentInfo) -> ModelResponse:
        return ModelResponse(parts=[])

    return FunctionModel(function=function, stream_function=stream_function)


def _mock_turn_models(monkeypatch: pytest.MonkeyPatch, *turn_models: FunctionModel) -> None:
    """Serve one scripted model per chat turn, in order."""
    remaining_models = iter(turn_models)

    async def _fake_build_model(*args: object, **kwargs: object) -> FunctionModel:
        return next(remaining_models)

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)


async def test_compact_agent_session_persists_durable_points_and_loads_latest_history(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    summary_messages: list[ModelMessage] = []
    chat_messages: list[ModelMessage] = []
    second_summary_messages: list[ModelMessage] = []
    second_chat_messages: list[ModelMessage] = []
    checkpoint = {
        "objectives": ["Investigate the trace"],
        "constraints_and_preferences": [],
        "decisions": [],
        "completed_work": ["Located the slow span"],
        "active_work": [],
        "blockers": [],
        "next_steps": ["Inspect the latest turn"],
        "important_details": ["trace-id-123"],
    }

    def compact_function(messages: list[ModelMessage], agent_info: AgentInfo) -> ModelResponse:
        summary_messages.extend(messages)
        return ModelResponse(
            parts=[ToolCallPart(tool_name="conversation_checkpoint", args=checkpoint)]
        )

    async def chat_stream_function(
        messages: list[ModelMessage],
        agent_info: AgentInfo,
    ) -> AsyncIterator[str]:
        chat_messages.extend(messages)
        yield "done"

    compact_model = FunctionModel(function=compact_function)
    chat_model = FunctionModel(stream_function=chat_stream_function)

    def second_compact_function(
        messages: list[ModelMessage], agent_info: AgentInfo
    ) -> ModelResponse:
        second_summary_messages.extend(messages)
        return ModelResponse(
            parts=[
                ToolCallPart(
                    tool_name="conversation_checkpoint",
                    args={
                        "objectives": ["Finish the investigation"],
                        "constraints_and_preferences": [],
                        "decisions": [],
                        "completed_work": [],
                        "active_work": [],
                        "blockers": [],
                        "next_steps": [],
                        "important_details": [],
                    },
                )
            ]
        )

    async def second_chat_stream_function(
        messages: list[ModelMessage],
        agent_info: AgentInfo,
    ) -> AsyncIterator[str]:
        second_chat_messages.extend(messages)
        yield "finished"

    _mock_turn_models(
        monkeypatch,
        compact_model,
        chat_model,
        FunctionModel(function=second_compact_function),
        FunctionModel(stream_function=second_chat_stream_function),
    )

    transcript = [
        _user_message("Find the slow span", message_id="user-1"),
        {
            "id": "assistant-1",
            "role": "assistant",
            "parts": [{"type": "text", "text": "The slow span is trace-id-123."}],
        },
        _user_message("What should I inspect next?", message_id="user-2"),
        {
            "id": "assistant-2",
            "role": "assistant",
            "parts": [{"type": "text", "text": "Inspect the latest model call."}],
        },
    ]
    agent_session_id = await _create_agent_session_row(
        db,
        project_session_id="91919191-9191-4191-8191-919191919191",
        title="Existing session",
        messages=transcript,
    )
    async with db() as session:
        seeded_session_rowid = await session.scalar(select(models.AgentSession.id))
        assert seeded_session_rowid is not None
        session.add(
            models.AgentSessionSnapshot(
                agent_session_id=seeded_session_rowid,
                bashkit_snapshot=b"shell-state",
            )
        )

    compact_response = await httpx_client.post(
        _compact_url(agent_session_id),
        json=_compact_body(),
    )

    assert compact_response.status_code == 200
    compact_result = compact_response.json()
    assert compact_result["compacted"] is True
    compaction_message = compact_result["compactionMessage"]
    assert compaction_message["role"] == "user"
    assert compaction_message["metadata"] == {"type": "compaction"}
    assert (
        compaction_message["parts"][0]["text"]
        == """<objectives>
- Investigate the trace
</objectives>
<completed_work>
- Located the slow span
</completed_work>
<next_steps>
- Inspect the latest turn
</next_steps>
<important_details>
- trace-id-123
</important_details>"""
    )
    assert "Find the slow span" in str(summary_messages)
    assert "trace-id-123" in str(summary_messages)
    assert "What should I inspect next?" in str(summary_messages)
    assert "Inspect the latest model call." in str(summary_messages)
    async with db() as session:
        snapshot = await session.scalar(select(models.AgentSessionSnapshot))
        assert snapshot is not None
        assert snapshot.bashkit_snapshot == b"shell-state"
        agent_session_rowid = snapshot.agent_session_id
        original_messages = await _load_session_messages(session, agent_session_rowid)
        compaction_points = (
            await session.scalars(select(models.AgentSessionCompactionPoint))
        ).all()
    assert len(compaction_points) == 1
    assert [message["id"] for message in original_messages] == [
        "user-1",
        "assistant-1",
        "user-2",
        "assistant-2",
        compaction_message["id"],
    ]

    chat_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            "91919191-9191-4191-8191-919191919191",
            _user_message("Continue", message_id="user-3"),
        ),
    )

    assert chat_response.status_code == 200
    projected_history = str(chat_messages)
    assert "Investigate the trace" in projected_history
    assert "Find the slow span" not in projected_history
    assert "The slow span is trace-id-123." not in projected_history
    assert "What should I inspect next?" not in projected_history
    assert "Inspect the latest model call." not in projected_history
    assert "Continue" in projected_history
    async with db() as session:
        stored_messages = await _load_session_messages(session, agent_session_rowid)
    assert [message["id"] for message in stored_messages[:5]] == [
        "user-1",
        "assistant-1",
        "user-2",
        "assistant-2",
        compaction_message["id"],
    ]
    assert stored_messages[5]["id"] == "user-3"

    second_compact_response = await httpx_client.post(
        _compact_url(agent_session_id),
        json=_compact_body(),
    )

    assert second_compact_response.status_code == 200
    second_compaction_message = second_compact_response.json()["compactionMessage"]
    assert second_compaction_message["id"] != compaction_message["id"]
    assert second_compaction_message["metadata"] == {"type": "compaction"}
    second_summary_input = str(second_summary_messages)
    assert "Investigate the trace" in second_summary_input
    assert "Continue" in second_summary_input
    assert "Find the slow span" not in second_summary_input
    async with db() as session:
        compaction_points = (
            await session.scalars(select(models.AgentSessionCompactionPoint))
        ).all()
    assert len(compaction_points) == 2

    second_chat_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            "91919191-9191-4191-8191-919191919191",
            _user_message("Finish", message_id="user-4"),
        ),
    )

    assert second_chat_response.status_code == 200
    second_projected_history = str(second_chat_messages)
    assert "Finish the investigation" in second_projected_history
    assert "Investigate the trace" not in second_projected_history
    assert "Continue" not in second_projected_history
    assert "Finish" in second_projected_history


async def test_compact_agent_session_without_a_completed_turn_is_a_noop(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _unexpected_build_model(*args: object, **kwargs: object) -> FunctionModel:
        raise AssertionError("a no-op compaction must not build a model")

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _unexpected_build_model)
    agent_session_id = await _create_agent_session_row(
        db,
        project_session_id="92929292-9292-4292-8292-929292929292",
        title="Incomplete turn",
        messages=[
            _user_message("Hello", message_id="user-1"),
        ],
    )

    response = await httpx_client.post(_compact_url(agent_session_id), json=_compact_body())

    assert response.status_code == 200
    assert response.json() == {"compacted": False}
    async with db() as session:
        assert await session.scalar(select(models.AgentSessionSnapshot)) is None


async def test_chat_turn_persists_session_transcript(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A full chat turn against a pre-created session writes its transcript:
    the incoming history plus the streamed assistant reply (with turn
    metadata), assembled entirely server-side."""

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "44444444-4444-4444-8444-444444444444"
    agent_session_id = await _create_agent_session_row(db, project_session_id=session_id)
    body = _chat_body(
        session_id,
        _user_message("What datasets exist?"),
    )

    response = await httpx_client.post(_chat_url(agent_session_id), json=body)
    assert response.status_code == 200
    chunks = _stream_chunks(response.text)
    # A new session's first turn streams the LLM session title as a transient
    # data chunk (TestModel fills the summary tool with generated args: "a").
    assert "data-session-summary" in response.text
    start_chunks = [chunk for chunk in chunks if chunk.get("type") == "start"]
    assert len(start_chunks) == 1
    assert UUID(start_chunks[0]["messageId"]).version == 4
    persistence_chunks = [
        chunk for chunk in chunks if chunk.get("type") == "data-transcript-persisted"
    ]
    assert len(persistence_chunks) == 1
    assert persistence_chunks[0]["data"]["messageId"] == start_chunks[0]["messageId"]
    finish_index = next(index for index, chunk in enumerate(chunks) if chunk["type"] == "finish")
    persistence_index = chunks.index(persistence_chunks[0])
    assert persistence_index > finish_index

    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        assert agent_session.user_id is None
        assert UUID(agent_session.project_session_id).version == 4
        assert agent_session.project_name == get_env_phoenix_agents_assistant_project_name()
        # The in-stream summary is persisted as the session title.
        assert agent_session.title == "a"
        messages = await _load_session_messages(session, agent_session.id)
        message_rowids = list(
            await session.scalars(
                select(models.AgentSessionMessage.id)
                .where(models.AgentSessionMessage.agent_session_id == agent_session.id)
                .order_by(models.AgentSessionMessage.position)
            )
        )
        persisted_session_id = agent_session.project_session_id
        # No bash command this turn, so no shell-state snapshot row.
        assert await session.scalar(select(models.AgentSessionSnapshot)) is None

    assert messages[0]["role"] == "user"
    assistant_messages = [message for message in messages if message["role"] == "assistant"]
    assert assistant_messages
    assert assistant_messages[-1] == await _accumulate_streamed_assistant_message(chunks)
    assert UUID(assistant_messages[-1]["id"]).version == 4
    start_chunks = [chunk for chunk in chunks if chunk.get("type") == "start"]
    assert start_chunks
    assert start_chunks[-1]["messageId"] == assistant_messages[-1]["id"]
    metadata = assistant_messages[-1]["metadata"]
    assert metadata["sessionId"] == persisted_session_id
    assert metadata["usage"]["tokens"]["total"] > 0
    # Resuming a session sends the persisted transcript back through the chat
    # request's message validation, so every stored message must round-trip.
    for message in messages:
        PhoenixUIMessage.model_validate(message)
    async with db() as session:
        stored_message_rows = (
            await session.scalars(
                select(models.AgentSessionMessage).order_by(models.AgentSessionMessage.position)
            )
        ).all()
        assert [row.message_id for row in stored_message_rows] == [
            row.message.id for row in stored_message_rows
        ]

    # Later turns carry only the new message; the server merges it into the
    # transcript it already owns.
    second_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json={
            **body,
            "message": _user_message("And experiments?", message_id="msg-user-2"),
        },
    )
    assert second_response.status_code == 200
    # Only a session's first turn summarizes; later turns keep the stored title.
    assert "data-session-summary" not in second_response.text
    second_metadata_chunks = [
        chunk["messageMetadata"]
        for chunk in _stream_chunks(second_response.text)
        if chunk.get("type") == "message-metadata" and "sessionId" in chunk["messageMetadata"]
    ]
    assert len(second_metadata_chunks) == 1
    assert second_metadata_chunks[0]["sessionId"] == persisted_session_id
    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        assert agent_session.title == "a"
        second_turn_messages = await _load_session_messages(session, agent_session.id)
        second_turn_message_rowids = list(
            await session.scalars(
                select(models.AgentSessionMessage.id)
                .where(models.AgentSessionMessage.agent_session_id == agent_session.id)
                .order_by(models.AgentSessionMessage.position)
            )
        )
    # The merged transcript contains both turns in order, assembled server-side.
    user_message_ids = [
        message["id"] for message in second_turn_messages if message["role"] == "user"
    ]
    assert user_message_ids == ["msg-user-1", "msg-user-2"]
    assert len(second_turn_messages) > len(messages)
    assert second_turn_message_rowids[: len(message_rowids)] == message_rowids


async def test_failed_chat_turn_does_not_persist_partial_transcript(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def failing_run_stream(
        _adapter: VercelAIAdapter[Any, Any],
        **_kwargs: Any,
    ) -> AsyncIterator[BaseChunk]:
        yield StartChunk(message_id="partial-assistant")
        yield TextStartChunk(id="text")
        yield TextDeltaChunk(id="text", delta="partial response")
        raise RuntimeError("model stream failed")

    monkeypatch.setattr(VercelAIAdapter, "run_stream", failing_run_stream)

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "46464646-4646-4464-8464-464646464646"
    persisted_messages = [_user_message("earlier message")]
    agent_session_id = await _create_agent_session_row(
        db,
        project_session_id=session_id,
        title="Already titled",
        messages=persisted_messages,
    )

    with pytest.raises(RuntimeError, match="model stream failed"):
        await httpx_client.post(
            _chat_url(agent_session_id),
            json=_chat_body(
                session_id,
                _user_message("new message", message_id="msg-user-2"),
            ),
        )

    async with db() as session:
        agent_session_rowid = await session.scalar(select(models.AgentSession.id))
        assert agent_session_rowid is not None
        stored_messages = await _load_session_messages(session, agent_session_rowid)
    assert stored_messages == persisted_messages


async def test_client_tool_continuation_extends_the_persisted_assistant_message(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_id = "45454545-4545-4454-8454-454545454545"
    agent_session_id = await _create_agent_session_row(
        db,
        project_session_id=session_id,
        title="Already titled",
    )
    model = _client_tool_model()
    _mock_turn_models(monkeypatch, model, model)

    first_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(session_id, _user_message("list my datasets")),
    )
    assert first_response.status_code == 200
    first_chunks = _stream_chunks(first_response.text)
    first_start = next(chunk for chunk in first_chunks if chunk["type"] == "start")
    assistant_message_id = first_start["messageId"]

    async with db() as session:
        agent_session_rowid = await session.scalar(select(models.AgentSession.id))
        assert agent_session_rowid is not None
        stored_messages = await _load_session_messages(session, agent_session_rowid)
    assert len(stored_messages) == 2
    resolved_assistant_message = stored_messages[-1]
    assert resolved_assistant_message["id"] == assistant_message_id
    tool_part = next(
        part for part in resolved_assistant_message["parts"] if part["type"] == "tool-list_datasets"
    )
    tool_part["state"] = "output-available"
    tool_part["output"] = {"datasets": []}

    continuation_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(session_id, resolved_assistant_message),
    )
    assert continuation_response.status_code == 200
    continuation_chunks = _stream_chunks(continuation_response.text)
    continuation_start = next(chunk for chunk in continuation_chunks if chunk["type"] == "start")
    assert continuation_start["messageId"] == assistant_message_id
    continuation_acknowledgement = next(
        chunk for chunk in continuation_chunks if chunk["type"] == "data-transcript-persisted"
    )
    assert continuation_acknowledgement["data"]["messageId"] == assistant_message_id

    async with db() as session:
        stored_rows = (
            await session.scalars(
                select(models.AgentSessionMessage)
                .where(models.AgentSessionMessage.agent_session_id == agent_session_rowid)
                .order_by(models.AgentSessionMessage.position)
            )
        ).all()
    assert len(stored_rows) == 2
    persisted_assistant = stored_rows[-1]
    assert persisted_assistant.message_id == assistant_message_id
    assert persisted_assistant.message.id == assistant_message_id
    persisted_tool_part = next(
        part
        for part in persisted_assistant.message.parts
        if getattr(part, "tool_call_id", None) == tool_part["toolCallId"]
    )
    assert isinstance(persisted_tool_part, ToolOutputAvailablePart)
    assert persisted_tool_part.output == {"datasets": []}
    assert any(
        isinstance(part, TextUIPart) and part.text == "done"
        for part in persisted_assistant.message.parts
    )


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
                                "toolExecutionEnvironment": "client",
                                "toolInputEmittedAt": (now + timedelta(seconds=1)).isoformat(),
                                "clientStartedAt": (now - timedelta(minutes=1)).isoformat(),
                                "clientEndedAt": (now + timedelta(minutes=1)).isoformat(),
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
                                "toolExecutionEnvironment": "client",
                                "toolInputEmittedAt": (now + timedelta(seconds=1)).isoformat(),
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
    agent_session_id = await _create_agent_session_row(db, project_session_id=session_id)

    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("hello"),
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
        agent_session_rowid = await session.scalar(select(models.AgentSession.id))
        assert agent_session_rowid is not None
        stored_messages = await _load_session_messages(session, agent_session_rowid)
    assistant_messages = [message for message in stored_messages if message["role"] == "assistant"]
    assert assistant_messages
    assert assistant_messages[-1]["metadata"]["trace"] == {
        "traceId": trace_id,
        "rootSpanId": root_span_id,
    }


async def test_chat_turn_without_a_message_is_rejected(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    """A submit request must carry the turn's new message."""
    session_id = "22222222-2222-4222-8222-222222222222"
    agent_session_id = await _create_agent_session_row(db, project_session_id=session_id)

    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(session_id, None),
    )
    assert response.status_code == 422

    async with db() as session:
        assert (await session.scalars(select(models.AgentSessionMessage))).all() == []


async def test_chat_turn_with_unknown_agent_session_id_returns_not_found(
    httpx_client: httpx.AsyncClient,
) -> None:
    session_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

    response = await httpx_client.post(
        _chat_url(str(GlobalID("AgentSession", "999999"))),
        json=_chat_body(
            session_id,
            _user_message("hello"),
        ),
    )
    assert response.status_code == 404


def _validated_messages(raw_messages: list[dict[str, Any]]) -> list[PhoenixUIMessage]:
    return [PhoenixUIMessage.model_validate(raw_message) for raw_message in raw_messages]


def _assistant_message_with_tool_states() -> dict[str, Any]:
    return {
        "id": "assistant-1",
        "role": "assistant",
        "parts": [
            {"type": "text", "text": "Working on it"},
            {
                "type": "tool-bash",
                "toolCallId": "tool-call-unresolved",
                "state": "input-available",
                "input": {"command": "ls"},
            },
            {
                "type": "tool-bash",
                "toolCallId": "tool-call-streaming",
                "state": "input-streaming",
            },
            {
                "type": "tool-bash",
                "toolCallId": "tool-call-done",
                "state": "output-available",
                "input": {"command": "pwd"},
                "output": {"stdout": "/"},
            },
        ],
    }


def test_merge_appends_user_message_without_modifying_persisted_messages() -> None:
    persisted = _validated_messages(
        [_user_message("run a command"), _assistant_message_with_tool_states()]
    )

    merged = _merge_messages(
        old_messages=persisted,
        new_message=PhoenixUIMessage.model_validate(
            _user_message("never mind", message_id="msg-user-2")
        ),
    )

    assert [message.id for message in merged] == ["msg-user-1", "assistant-1", "msg-user-2"]
    assert merged[1] is persisted[1]


def test_merge_replaces_the_trailing_assistant_message() -> None:
    persisted = _validated_messages(
        [_user_message("run a command"), _assistant_message_with_tool_states()]
    )
    resolved_assistant = PhoenixUIMessage.model_validate(
        {
            "id": "assistant-1",
            "role": "assistant",
            "parts": [
                {
                    "type": "tool-bash",
                    "toolCallId": "tool-call-unresolved",
                    "state": "output-available",
                    "input": {"command": "ls"},
                    "output": {"stdout": "README.md"},
                },
            ],
        }
    )

    merged = _merge_messages(
        old_messages=persisted,
        new_message=resolved_assistant,
    )

    assert [message.id for message in merged] == ["msg-user-1", "assistant-1"]
    assert merged[-1] is resolved_assistant


def test_merge_rejects_an_assistant_message_that_is_not_the_trailing_one() -> None:
    persisted = _validated_messages([_user_message("hello")])
    stale_assistant = PhoenixUIMessage.model_validate(
        {"id": "assistant-stale", "role": "assistant", "parts": []}
    )

    with pytest.raises(HTTPException) as exc_info:
        _merge_messages(
            old_messages=persisted,
            new_message=stale_assistant,
        )
    assert exc_info.value.status_code == 409


async def test_chat_endpoint_rejects_regenerate_requests(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    session_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    agent_session_id = await _create_agent_session_row(
        db,
        project_session_id=session_id,
        title="Already titled",
        messages=[
            _user_message("first question"),
            {
                "id": "assistant-1",
                "role": "assistant",
                "parts": [{"type": "text", "text": "stale answer"}],
            },
        ],
    )

    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            None,
            trigger="regenerate-message",
            messageId="assistant-1",
        ),
    )
    assert response.status_code == 422


async def test_failed_summary_leaves_session_untitled_until_a_later_turn(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failed first-turn summarization still persists the transcript but
    leaves the session untitled; the next turn retries summarization and the
    non-empty title then wins over the stored empty one."""
    session_id = "33333333-3333-4333-8333-333333333333"
    agent_session_id = await _create_agent_session_row(db, project_session_id=session_id)
    _mock_turn_models(
        monkeypatch,
        _scripted_model(summary=None),
        _scripted_model(summary="Second-turn title"),
    )

    first_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("first question"),
        ),
    )
    assert first_response.status_code == 200
    assert "data-session-summary" not in first_response.text
    async with db() as session:
        agent_sessions = (await session.scalars(select(models.AgentSession))).all()
        assert len(agent_sessions) == 1
        assert agent_sessions[0].title == ""
        stored_messages = await _load_session_messages(session, agent_sessions[0].id)
        assert stored_messages

    second_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("second question", message_id="msg-user-2"),
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
        assert len(await _load_session_messages(session, agent_sessions[0].id)) > len(
            stored_messages
        )


async def test_bash_shell_state_persists_across_chat_turns(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Shell state written by a bash command in one turn survives to later
    turns: the snapshot is persisted, left intact by turns without bash
    activity, and restored into the next turn's shell."""
    session_id = "55555555-5555-4555-8555-555555555555"
    agent_session_id = await _create_agent_session_row(db, project_session_id=session_id)
    note_path = "/home/user/workspace/note.txt"
    _mock_turn_models(
        monkeypatch,
        _scripted_model(bash_command=f"echo hello > {note_path}"),
        _scripted_model(bash_command=None),
        _scripted_model(bash_command=f"cat {note_path}"),
    )

    first_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("write a note"),
        ),
    )
    assert first_response.status_code == 200
    first_chunks = _stream_chunks(first_response.text)
    async with db() as session:
        snapshots = (await session.scalars(select(models.AgentSessionSnapshot))).all()
        assert len(snapshots) == 1
        first_snapshot = snapshots[0].bashkit_snapshot
        assert first_snapshot
        agent_session_rowid = snapshots[0].agent_session_id
        stored_messages = await _load_session_messages(session, agent_session_rowid)

    assistant_messages = [message for message in stored_messages if message["role"] == "assistant"]
    assert len(assistant_messages) == 1
    part_types = [part["type"] for part in assistant_messages[0]["parts"]]
    assert "tool-bash" in part_types
    assert "text" in part_types
    assert part_types.count("step-start") == sum(
        chunk.get("type") == "start-step" for chunk in first_chunks
    )

    second_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("thanks", message_id="msg-user-2"),
        ),
    )
    assert second_response.status_code == 200
    async with db() as session:
        # A turn without bash activity leaves the stored shell state intact.
        snapshots = (await session.scalars(select(models.AgentSessionSnapshot))).all()
        assert len(snapshots) == 1
        assert snapshots[0].bashkit_snapshot == first_snapshot
        stored_messages = await _load_session_messages(session, agent_session_rowid)

    third_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("read it back", message_id="msg-user-3"),
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


async def test_server_agent_chat_turn_persists_session_transcript(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "56565656-5656-4656-8656-565656565656"
    agent_session_id = await _create_agent_session_row(db, project_session_id=session_id)

    response = await httpx_client.post(
        _server_agent_chat_url(agent_session_id),
        json=_chat_body(session_id, _user_message("What datasets exist?")),
    )
    assert response.status_code == 200
    # The persisted-session contract is not the deprecated one, even though
    # the URL is shared with the legacy stateless route.
    assert "deprecation" not in response.headers
    chunks = _stream_chunks(response.text)
    chunk_types = {chunk["type"] for chunk in chunks}
    assert "start" in chunk_types
    assert "text-delta" in chunk_types
    assert "data-transcript-persisted" in chunk_types

    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        agent_session_rowid = agent_session.id
        messages = await _load_session_messages(session, agent_session_rowid)
    assert [message["role"] for message in messages] == ["user", "assistant"]
    assert messages[-1] == await _accumulate_streamed_assistant_message(chunks)

    second_response = await httpx_client.post(
        _server_agent_chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("And experiments?", message_id="msg-user-2"),
        ),
    )
    assert second_response.status_code == 200
    async with db() as session:
        second_turn_messages = await _load_session_messages(session, agent_session_rowid)
    user_message_ids = [
        message["id"] for message in second_turn_messages if message["role"] == "user"
    ]
    assert user_message_ids == ["msg-user-1", "msg-user-2"]
    assert len(second_turn_messages) > len(messages)


async def test_server_agent_bash_shell_state_persists_across_chat_turns(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Mirror of ``test_bash_shell_state_persists_across_chat_turns`` for
    ``agent_id="server"``: pins the snapshot wiring ``build_server_agent``
    gained for the session route."""
    session_id = "57575757-5757-4757-8757-575757575757"
    agent_session_id = await _create_agent_session_row(db, project_session_id=session_id)
    note_path = "/home/user/workspace/note.txt"
    _mock_turn_models(
        monkeypatch,
        _scripted_model(bash_command=f"echo hello > {note_path}"),
        _scripted_model(bash_command=f"cat {note_path}"),
    )

    first_response = await httpx_client.post(
        _server_agent_chat_url(agent_session_id),
        json=_chat_body(session_id, _user_message("write a note")),
    )
    assert first_response.status_code == 200
    async with db() as session:
        snapshots = (await session.scalars(select(models.AgentSessionSnapshot))).all()
        assert len(snapshots) == 1
        assert snapshots[0].bashkit_snapshot

    second_response = await httpx_client.post(
        _server_agent_chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("read it back", message_id="msg-user-2"),
        ),
    )
    assert second_response.status_code == 200
    # The second turn's shell was restored from the persisted snapshot, so the
    # file written in the first turn is still there.
    bash_outputs = [
        chunk["output"]
        for chunk in _stream_chunks(second_response.text)
        if chunk.get("type") == "tool-output-available" and "output" in chunk
    ]
    assert any(output.get("stdout") == "hello\n" for output in bash_outputs)


async def test_server_agent_chat_is_forbidden_when_bash_is_disabled(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """``PHOENIX_AGENTS_DISABLE_BASH`` turns off the server agent on the
    session chat route while leaving the assistant agent available."""
    monkeypatch.setenv("PHOENIX_AGENTS_DISABLE_BASH", "true")

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "58585858-5858-4858-8858-585858585858"
    agent_session_id = await _create_agent_session_row(db, project_session_id=session_id)

    server_response = await httpx_client.post(
        _server_agent_chat_url(agent_session_id),
        json=_chat_body(session_id, _user_message("hello")),
    )
    assert server_response.status_code == 403
    assert "Server agent is disabled" in server_response.text

    assistant_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(session_id, _user_message("hello")),
    )
    assert assistant_response.status_code == 200


# ---------------------------------------------------------------------------
# Session creation route
# ---------------------------------------------------------------------------


async def test_create_session_route_creates_a_temporary_session(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.post(
        "/agents/server/sessions",
        json={"title": " CLI session ", "temporary": True},
    )
    assert response.status_code == 201

    global_id = GlobalID.from_id(response.json()["data"]["id"])
    assert global_id.type_name == models.AgentSession.__name__
    async with db() as session:
        agent_session = await session.get(models.AgentSession, int(global_id.node_id))
        assert agent_session is not None
        assert agent_session.title == "CLI session"
        assert agent_session.user_id is None
        assert agent_session.project_name == get_env_phoenix_agents_assistant_project_name()
        assert agent_session.expires_at is not None
        assert agent_session.expires_at > datetime.now(timezone.utc)


async def test_create_session_route_defaults_to_a_persistent_untitled_session(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.post("/agents/assistant/sessions", json={})
    assert response.status_code == 201

    global_id = GlobalID.from_id(response.json()["data"]["id"])
    async with db() as session:
        agent_session = await session.get(models.AgentSession, int(global_id.node_id))
        assert agent_session is not None
        assert agent_session.title == ""
        assert agent_session.expires_at is None


async def test_create_session_route_yields_a_chattable_session(
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The returned id is directly usable as the chat route's session id."""

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)

    created = await httpx_client.post(
        "/agents/server/sessions",
        json={"temporary": True},
    )
    assert created.status_code == 201

    response = await httpx_client.post(
        _server_agent_chat_url(created.json()["data"]["id"]),
        json=_chat_body("11111111-1111-4111-8111-111111111111", _user_message("hello")),
    )
    assert response.status_code == 200


async def test_create_session_route_rejects_unknown_agents(
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.post("/agents/unknown/sessions", json={})
    assert response.status_code == 404


async def test_create_session_route_is_forbidden_when_agents_are_disabled(
    app: FastAPI,
    httpx_client: httpx.AsyncClient,
) -> None:
    await app.state.system_settings.update_agent_assistant_enabled(
        AgentAssistantEnabledSetting(enabled=False)
    )

    response = await httpx_client.post("/agents/server/sessions", json={})
    assert response.status_code == 403
    assert "Agents are disabled" in response.text


async def test_create_session_route_forbids_the_server_agent_when_bash_is_disabled(
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PHOENIX_AGENTS_DISABLE_BASH", "true")

    server_response = await httpx_client.post("/agents/server/sessions", json={})
    assert server_response.status_code == 403
    assert "Server agent is disabled" in server_response.text

    assistant_response = await httpx_client.post("/agents/assistant/sessions", json={})
    assert assistant_response.status_code == 201


async def test_agents_router_is_forbidden_in_read_only_mode(
    app: FastAPI,
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    """Read-only mode turns off the whole agents router, chat included."""
    session_id = "77777777-7777-4777-8777-777777777777"
    agent_session_id = await _create_agent_session_row(db, project_session_id=session_id)
    app.state.read_only = True

    create_response = await httpx_client.post("/agents/server/sessions", json={})
    assert create_response.status_code == 403

    chat_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(session_id, _user_message("hello")),
    )
    assert chat_response.status_code == 403


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
    agent_session_id: str,
) -> httpx.Response:
    return await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("What datasets exist?"),
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
    agent_session_id = await _create_agent_session_row(db, project_session_id=session_id)

    response = await _post_traced_chat_turn(httpx_client, session_id, agent_session_id)
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
    under a project session keyed by the persisted agent session ID, without tripping
    SQLAlchemy's transient-object relationship warnings on autoflush."""
    await _enable_local_trace_recording(app)
    await _ingest_browser_trace(db)
    _mock_traced_test_model(monkeypatch)
    session_id = "77777777-7777-4777-8777-777777777777"
    agent_session_id = await _create_agent_session_row(db, project_session_id=session_id)

    with warnings.catch_warnings():
        warnings.simplefilter("error", SAWarning)
        response = await _post_traced_chat_turn(httpx_client, session_id, agent_session_id)
        assert response.status_code == 200

    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        project_session = await session.scalar(
            select(models.ProjectSession).where(
                models.ProjectSession.session_id == agent_session.project_session_id
            )
        )
        assert project_session is not None
        merged_trace = await session.scalar(
            select(models.Trace).where(models.Trace.trace_id == _BROWSER_TRACE_ID)
        )
        assert merged_trace is not None
        assert merged_trace.project_session_rowid == project_session.id


async def test_resumed_chat_turn_keeps_original_trace_project(
    db: DbSessionFactory,
    app: FastAPI,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A session's persisted project remains authoritative after configuration changes."""
    await _enable_local_trace_recording(app)
    tracer_project_names: list[str] = []

    async def _fake_build_model(
        *args: object,
        tracer_provider: TracerProvider | None = None,
        **kwargs: object,
    ) -> OpenInferenceModelWrapper:
        assert tracer_provider is not None
        project_name = tracer_provider.resource.attributes[ResourceAttributes.PROJECT_NAME]
        assert isinstance(project_name, str)
        tracer_project_names.append(project_name)
        tracer = OITracer(tracer_provider.get_tracer(__name__), config=TraceConfig())
        return OpenInferenceModelWrapper(TestModel(call_tools=[]), tracer=tracer)

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    original_project_name = "original-assistant-project"
    changed_project_name = "changed-assistant-project"
    first_trace_id = "8" * 32
    second_trace_id = "a" * 32
    session_request_id = "88888888-8888-4888-8888-888888888888"

    monkeypatch.setenv("PHOENIX_AGENTS_ASSISTANT_PROJECT_NAME", original_project_name)
    agent_session_id = await _create_agent_session_row(db, project_session_id=session_request_id)
    first_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_request_id,
            _user_message("first question"),
            ingestTraces=True,
            turnTraceContext={
                "traceId": first_trace_id,
                "rootSpanId": "9" * 16,
                "startedAt": _BROWSER_TURN_TIME.isoformat(),
            },
        ),
    )
    assert first_response.status_code == 200

    monkeypatch.setenv("PHOENIX_AGENTS_ASSISTANT_PROJECT_NAME", changed_project_name)
    second_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_request_id,
            _user_message("second question", message_id="msg-user-2"),
            ingestTraces=True,
            turnTraceContext={
                "traceId": second_trace_id,
                "rootSpanId": "b" * 16,
                "startedAt": (_BROWSER_TURN_TIME + timedelta(minutes=1)).isoformat(),
            },
        ),
    )
    assert second_response.status_code == 200

    assert tracer_project_names == [original_project_name, original_project_name]
    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        assert agent_session.project_name == original_project_name
        traces = (
            await session.scalars(
                select(models.Trace).where(
                    models.Trace.trace_id.in_([first_trace_id, second_trace_id])
                )
            )
        ).all()
        assert len(traces) == 2
        assert len({trace.project_rowid for trace in traces}) == 1
        assert len({trace.project_session_rowid for trace in traces}) == 1
        project = await session.get(models.Project, traces[0].project_rowid)
        assert project is not None
        assert project.name == original_project_name
        assert (
            await session.scalar(
                select(func.count()).where(models.Project.name == changed_project_name)
            )
            == 0
        )
