"""Behavioral tests for the agents router.

Tests cover both router-level helpers and observable behavior through the
public chat route. The LLM is the only mocked seam in behavioral tests.
"""

import asyncio
import json
import warnings
from collections.abc import AsyncIterator, MutableMapping
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import MagicMock
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI
from openinference.instrumentation import OITracer, TraceConfig
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.sdk.trace import TracerProvider
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
from pydantic_ai.usage import RequestUsage
from sqlalchemy import func, select, update
from sqlalchemy.exc import SAWarning
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.types import ASGIApp
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
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.agents.model_selection import BuiltInProviderModelSelection
from phoenix.server.agents.pydantic_ai import OpenInferenceModelWrapper
from phoenix.server.agents.session_titles import MAX_AGENT_SESSION_TITLE_LENGTH
from phoenix.server.agents.ui_message_stream import iter_chunks_with_error_parts
from phoenix.server.agents.vercel_ui_message_stream import read_ui_message_stream
from phoenix.server.api.helpers.agent_sessions import TURN_LOCK_STALENESS, get_otel_session_id
from phoenix.server.api.routers.agents import (
    AgentSessionConflict,
    _build_message_metadata_chunk,
    _emit_turn_root_span,
    _get_span_context,
    _merge_messages,
    _persist_agent_session_turn,
    _persist_db_traces,
    _resolve_turn_trace_ids,
    _synthesize_client_tool_spans,
    _to_pydantic_ai_messages,
    _turn_parent_context,
)
from phoenix.server.authorization import insufficient_storage_message
from phoenix.server.settings.registry import (
    AgentAssistantEnabledSetting,
    AgentTraceRecordingSetting,
)
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer
from tests.unit._helpers import _agent_session_model_kwargs, _message_uuid

_BUILD_MODEL_PATCH_TARGET = "phoenix.server.api.routers.agents.build_model"


_DEFAULT_USER_MESSAGE_ID = _message_uuid("msg-user-1")


def _user_message(text: str, *, message_id: str = _DEFAULT_USER_MESSAGE_ID) -> dict[str, Any]:
    return {
        "id": message_id,
        "role": "user",
        "parts": [{"type": "text", "text": text}],
    }


def _chat_url(agent_session_id: str) -> str:
    return f"/v1/agent_sessions/{agent_session_id}/chat"


def _compact_url(agent_session_id: str) -> str:
    return f"/v1/agent_sessions/{agent_session_id}/compact"


def _patch_session_url(agent_session_id: str) -> str:
    return f"/v1/agent_sessions/{agent_session_id}"


def _compact_body() -> dict[str, Any]:
    return {
        "model": {
            "providerType": "builtin",
            "provider": "OPENAI",
            "modelName": "gpt-test",
        }
    }


def _create_session_body(**overrides: Any) -> dict[str, Any]:
    return {
        "model": {
            "providerType": "builtin",
            "provider": "OPENAI",
            "modelName": "gpt-test",
        },
        **overrides,
    }


def _chat_body(
    session_id: str,
    message: dict[str, Any] | None,
    **overrides: Any,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "trigger": "submit-message",
        "id": session_id,
        "userAgentType": "web",
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


def _headless_chat_body(
    session_id: str,
    message: dict[str, Any] | None,
    **overrides: Any,
) -> dict[str, Any]:
    return _chat_body(session_id, message, userAgentType="headless", **overrides)


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
    title: str = "",
    messages: list[dict[str, Any]] | None = None,
) -> str:
    """Create a persisted session the way the UI's createAgentSession mutation
    does before its first chat request, optionally seeded with a transcript."""
    async with db() as session:
        agent_session = models.AgentSession(
            **_agent_session_model_kwargs(),
            user_id=None,
            title=title,
            project_name=get_env_phoenix_agents_assistant_project_name(),
        )
        session.add(agent_session)
        await session.flush()
        session.add_all(
            models.AgentSessionMessage(
                agent_session_id=agent_session.id,
                message=PhoenixUIMessage.model_validate(message),
            )
            for message in messages or []
        )
        return str(GlobalID("AgentSession", str(agent_session.id)))


async def _last_stored_message_id(db: DbSessionFactory) -> str:
    """The session's last persisted message id — what a fresh client would
    send as ``lastMessageId`` on its next turn."""
    async with db() as session:
        message_id = await session.scalar(
            select(models.AgentSessionMessage.message_id)
            .order_by(models.AgentSessionMessage.id.desc())
            .limit(1)
        )
    assert message_id is not None
    return message_id


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
    async for message in read_ui_message_stream(
        stream=iter_chunks_with_error_parts(_iter_chunks())
    ):
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
            .order_by(models.AgentSessionMessage.id)
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
        _user_message("Find the slow span", message_id=_message_uuid("user-1")),
        {
            "id": _message_uuid("assistant-1"),
            "role": "assistant",
            "parts": [{"type": "text", "text": "The slow span is trace-id-123."}],
        },
        _user_message("What should I inspect next?", message_id=_message_uuid("user-2")),
        {
            "id": _message_uuid("assistant-2"),
            "role": "assistant",
            "parts": [{"type": "text", "text": "Inspect the latest model call."}],
        },
    ]
    agent_session_id = await _create_agent_session_row(
        db,
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
    compaction_message = compact_response.json()["data"]
    assert compaction_message["role"] == "user"
    assert compaction_message["metadata"]["phoenix"]["type"] == "user"
    assert compaction_message["metadata"]["phoenix"]["isCompactionMessage"] is True
    assert (
        compaction_message["parts"][0]["text"]
        == """The following summarizes the conversation with the user so far. Use it as historical context, not as a new user request. Use the latest state described below when responding to subsequent user messages.

<objectives>
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
        compaction_message_count = await session.scalar(
            select(func.count())
            .select_from(models.AgentSessionMessage)
            .where(models.AgentSessionMessage.is_compaction_message)
        )
    assert compaction_message_count == 1
    assert [message["id"] for message in original_messages] == [
        _message_uuid("user-1"),
        _message_uuid("assistant-1"),
        _message_uuid("user-2"),
        _message_uuid("assistant-2"),
        compaction_message["id"],
    ]

    chat_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            "91919191-9191-4191-8191-919191919191",
            _user_message("Continue", message_id=_message_uuid("user-3")),
            lastMessageId=compaction_message["id"],
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
        _message_uuid("user-1"),
        _message_uuid("assistant-1"),
        _message_uuid("user-2"),
        _message_uuid("assistant-2"),
        compaction_message["id"],
    ]
    assert stored_messages[5]["id"] == _message_uuid("user-3")

    second_compact_response = await httpx_client.post(
        _compact_url(agent_session_id),
        json=_compact_body(),
    )

    assert second_compact_response.status_code == 200
    second_compaction_message = second_compact_response.json()["data"]
    assert second_compaction_message["id"] != compaction_message["id"]
    assert second_compaction_message["metadata"]["phoenix"]["isCompactionMessage"] is True
    second_summary_input = str(second_summary_messages)
    assert "Investigate the trace" in second_summary_input
    assert "Continue" in second_summary_input
    assert "Find the slow span" not in second_summary_input
    async with db() as session:
        compaction_message_count = await session.scalar(
            select(func.count())
            .select_from(models.AgentSessionMessage)
            .where(models.AgentSessionMessage.is_compaction_message)
        )
    assert compaction_message_count == 2

    second_chat_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            "91919191-9191-4191-8191-919191919191",
            _user_message("Finish", message_id=_message_uuid("user-4")),
            lastMessageId=second_compaction_message["id"],
        ),
    )

    assert second_chat_response.status_code == 200
    second_projected_history = str(second_chat_messages)
    assert "Finish the investigation" in second_projected_history
    assert "Investigate the trace" not in second_projected_history
    assert "Continue" not in second_projected_history
    assert "Finish" in second_projected_history


async def test_compact_agent_session_without_a_completed_turn_is_rejected_as_already_compact(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _unexpected_build_model(*args: object, **kwargs: object) -> FunctionModel:
        raise AssertionError("an already-compact conversation must not build a model")

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _unexpected_build_model)
    agent_session_id = await _create_agent_session_row(
        db,
        title="Incomplete turn",
        messages=[
            _user_message("Hello", message_id=_message_uuid("user-1")),
        ],
    )

    response = await httpx_client.post(_compact_url(agent_session_id), json=_compact_body())

    assert response.status_code == 409
    assert response.json()["code"] == "agent_session_already_compact"
    async with db() as session:
        assert await session.scalar(select(models.AgentSessionSnapshot)) is None


async def test_compact_is_rejected_while_a_turn_holds_the_session_lock(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Compaction contends for the same turn lock as a chat send: a live
    heartbeat means another turn is streaming, so compaction is rejected as
    busy before any model work — and must not release the other turn's lock."""

    async def _unexpected_build_model(*args: object, **kwargs: object) -> FunctionModel:
        raise AssertionError("a rejected compaction must not build a model")

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _unexpected_build_model)
    agent_session_id = await _create_agent_session_row(
        db,
        title="Busy session",
        messages=[
            _user_message("Hello", message_id=_message_uuid("user-1")),
            {
                "id": _message_uuid("assistant-1"),
                "role": "assistant",
                "parts": [{"type": "text", "text": "Hi there."}],
            },
        ],
    )
    live_heartbeat = datetime.now(timezone.utc)
    async with db() as session:
        await session.execute(update(models.AgentSession).values(heartbeat_at=live_heartbeat))

    response = await httpx_client.post(_compact_url(agent_session_id), json=_compact_body())

    assert response.status_code == 409
    assert response.json() == {"code": "agent_session_busy"}
    async with db() as session:
        stored = await session.scalar(select(models.AgentSession))
        assert stored is not None
        assert stored.heartbeat_at is not None
        compaction_message_count = await session.scalar(
            select(func.count())
            .select_from(models.AgentSessionMessage)
            .where(models.AgentSessionMessage.is_compaction_message)
        )
    assert compaction_message_count == 0


async def test_compact_takes_over_a_stale_session_lock(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A heartbeat older than the staleness window belongs to an abandoned
    turn: compaction claims the lock, compacts, and releases it."""
    checkpoint = {
        "objectives": ["Recover the session"],
        "constraints_and_preferences": [],
        "decisions": [],
        "completed_work": [],
        "active_work": [],
        "blockers": [],
        "next_steps": [],
        "important_details": [],
    }

    def compact_function(messages: list[ModelMessage], agent_info: AgentInfo) -> ModelResponse:
        return ModelResponse(
            parts=[ToolCallPart(tool_name="conversation_checkpoint", args=checkpoint)]
        )

    _mock_turn_models(monkeypatch, FunctionModel(function=compact_function))
    agent_session_id = await _create_agent_session_row(
        db,
        title="Abandoned turn",
        messages=[
            _user_message("Hello", message_id=_message_uuid("user-1")),
            {
                "id": _message_uuid("assistant-1"),
                "role": "assistant",
                "parts": [{"type": "text", "text": "Hi there."}],
            },
        ],
    )
    stale_heartbeat = datetime.now(timezone.utc) - TURN_LOCK_STALENESS * 2
    async with db() as session:
        await session.execute(update(models.AgentSession).values(heartbeat_at=stale_heartbeat))

    response = await httpx_client.post(_compact_url(agent_session_id), json=_compact_body())

    assert response.status_code == 200
    assert response.json()["data"]["metadata"]["phoenix"]["isCompactionMessage"] is True
    async with db() as session:
        stored = await session.scalar(select(models.AgentSession))
        assert stored is not None
        assert stored.heartbeat_at is None


async def test_chat_send_during_compaction_is_rejected_as_busy(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Compaction holds the session's turn lock while summarizing, so a
    concurrent chat send is rejected as busy; the lock is released once the
    compaction completes."""
    session_id = "95959595-9595-4595-8595-959595959595"
    checkpoint = {
        "objectives": ["Summarize while locked"],
        "constraints_and_preferences": [],
        "decisions": [],
        "completed_work": [],
        "active_work": [],
        "blockers": [],
        "next_steps": [],
        "important_details": [],
    }
    concurrent_sends: list[tuple[int, dict[str, Any]]] = []
    agent_session_id = await _create_agent_session_row(
        db,
        title="Compacting session",
        messages=[
            _user_message("Hello", message_id=_message_uuid("user-1")),
            {
                "id": _message_uuid("assistant-1"),
                "role": "assistant",
                "parts": [{"type": "text", "text": "Hi there."}],
            },
        ],
    )

    async def compact_function(
        messages: list[ModelMessage], agent_info: AgentInfo
    ) -> ModelResponse:
        # The summarization call is in flight: a follow-up send right now
        # must bounce off the turn lock the compaction is holding.
        chat_response = await httpx_client.post(
            _chat_url(agent_session_id),
            json=_chat_body(
                session_id,
                _user_message("follow-up", message_id=_message_uuid("user-2")),
                lastMessageId=_message_uuid("assistant-1"),
            ),
        )
        concurrent_sends.append((chat_response.status_code, chat_response.json()))
        return ModelResponse(
            parts=[ToolCallPart(tool_name="conversation_checkpoint", args=checkpoint)]
        )

    _mock_turn_models(monkeypatch, FunctionModel(function=compact_function))

    compact_response = await httpx_client.post(_compact_url(agent_session_id), json=_compact_body())

    assert compact_response.status_code == 200
    assert compact_response.json()["data"]["metadata"]["phoenix"]["isCompactionMessage"] is True
    assert concurrent_sends == [(409, {"code": "agent_session_busy"})]
    async with db() as session:
        stored = await session.scalar(select(models.AgentSession))
        assert stored is not None
        assert stored.heartbeat_at is None


async def test_compact_is_rejected_as_already_compact_when_a_concurrent_checkpoint_lands(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If another request's checkpoint is persisted while this one is
    summarizing (possible only after a stale-lock takeover), the conversation
    is already compact: the route answers 409 without writing a second
    checkpoint."""
    checkpoint = {
        "objectives": ["Lose the race"],
        "constraints_and_preferences": [],
        "decisions": [],
        "completed_work": [],
        "active_work": [],
        "blockers": [],
        "next_steps": [],
        "important_details": [],
    }
    agent_session_id = await _create_agent_session_row(
        db,
        title="Racing session",
        messages=[
            _user_message("Hello", message_id=_message_uuid("user-1")),
            {
                "id": _message_uuid("assistant-1"),
                "role": "assistant",
                "parts": [{"type": "text", "text": "Hi there."}],
            },
        ],
    )
    global_id = GlobalID.from_id(agent_session_id)
    foreign_checkpoint = {
        "id": _message_uuid("foreign-compaction-1"),
        "role": "user",
        "metadata": {
            "phoenix": {
                "type": "user",
                "currentDateTime": "2026-01-01T00:00:00+00:00",
                "timeZone": "UTC",
                "isCompactionMessage": True,
            }
        },
        "parts": [{"type": "text", "text": "A concurrent request's checkpoint."}],
    }

    async def compact_function(
        messages: list[ModelMessage], agent_info: AgentInfo
    ) -> ModelResponse:
        # The summarization call is in flight: another request's checkpoint
        # lands now, so this request's summary must be discarded.
        async with db() as session:
            session.add(
                models.AgentSessionMessage(
                    agent_session_id=int(global_id.node_id),
                    message=PhoenixUIMessage.model_validate(foreign_checkpoint),
                )
            )
        return ModelResponse(
            parts=[ToolCallPart(tool_name="conversation_checkpoint", args=checkpoint)]
        )

    _mock_turn_models(monkeypatch, FunctionModel(function=compact_function))

    response = await httpx_client.post(_compact_url(agent_session_id), json=_compact_body())

    assert response.status_code == 409
    assert response.json()["code"] == "agent_session_already_compact"
    async with db() as session:
        compaction_message_ids = list(
            await session.scalars(
                select(models.AgentSessionMessage.message_id).where(
                    models.AgentSessionMessage.is_compaction_message
                )
            )
        )
        stored = await session.scalar(select(models.AgentSession))
        assert stored is not None
        assert stored.heartbeat_at is None
    assert compaction_message_ids == [_message_uuid("foreign-compaction-1")]


async def test_compact_route_is_not_gated_by_bash_disablement(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Compaction is agent-agnostic: it summarizes the transcript with the
    session's persisted model, so disabling bash does not turn the route
    off even for sessions driven by the headless agent."""
    checkpoint = {
        "objectives": ["Compact a server session"],
        "constraints_and_preferences": [],
        "decisions": [],
        "completed_work": [],
        "active_work": [],
        "blockers": [],
        "next_steps": [],
        "important_details": [],
    }

    def compact_function(messages: list[ModelMessage], agent_info: AgentInfo) -> ModelResponse:
        return ModelResponse(
            parts=[ToolCallPart(tool_name="conversation_checkpoint", args=checkpoint)]
        )

    _mock_turn_models(monkeypatch, FunctionModel(function=compact_function))
    agent_session_id = await _create_agent_session_row(
        db,
        title="Server session",
        messages=[
            _user_message("Hello", message_id=_message_uuid("user-1")),
            {
                "id": _message_uuid("assistant-1"),
                "role": "assistant",
                "parts": [{"type": "text", "text": "Hi there."}],
            },
        ],
    )

    monkeypatch.setenv("PHOENIX_AGENTS_DISABLE_BASH", "true")
    response = await httpx_client.post(
        _compact_url(agent_session_id),
        json=_compact_body(),
    )
    assert response.status_code == 200
    assert response.json()["data"]["metadata"]["phoenix"]["isCompactionMessage"] is True


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
    agent_session_id = await _create_agent_session_row(db)
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
        assert agent_session.project_name == get_env_phoenix_agents_assistant_project_name()
        # The in-stream summary is persisted as the session title.
        assert agent_session.title == "a"
        messages = await _load_session_messages(session, agent_session.id)
        message_rowids = list(
            await session.scalars(
                select(models.AgentSessionMessage.id)
                .where(models.AgentSessionMessage.agent_session_id == agent_session.id)
                .order_by(models.AgentSessionMessage.id)
            )
        )
        persisted_session_id = get_otel_session_id(
            project_name=agent_session.project_name,
            agent_session_rowid=agent_session.id,
        )
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
    metadata = assistant_messages[-1]["metadata"]["phoenix"]
    assert metadata["sessionId"] == persisted_session_id
    assert metadata["usage"]["tokens"]["total"] > 0
    # Resuming a session sends the persisted transcript back through the chat
    # request's message validation, so every stored message must round-trip.
    for message in messages:
        PhoenixUIMessage.model_validate(message)
    async with db() as session:
        stored_message_rows = (
            await session.scalars(
                select(models.AgentSessionMessage).order_by(models.AgentSessionMessage.id)
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
            "message": _user_message("And experiments?", message_id=_message_uuid("msg-user-2")),
            "lastMessageId": assistant_messages[-1]["id"],
        },
    )
    assert second_response.status_code == 200
    # Only a session's first turn summarizes; later turns keep the stored title.
    assert "data-session-summary" not in second_response.text
    second_metadata_chunks = [
        chunk["messageMetadata"]
        for chunk in _stream_chunks(second_response.text)
        if chunk.get("type") == "message-metadata" and "phoenix" in chunk["messageMetadata"]
    ]
    assert len(second_metadata_chunks) == 1
    assert second_metadata_chunks[0]["phoenix"]["sessionId"] == persisted_session_id
    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        assert agent_session.title == "a"
        second_turn_messages = await _load_session_messages(session, agent_session.id)
        second_turn_message_rowids = list(
            await session.scalars(
                select(models.AgentSessionMessage.id)
                .where(models.AgentSessionMessage.agent_session_id == agent_session.id)
                .order_by(models.AgentSessionMessage.id)
            )
        )
    # The merged transcript contains both turns in order, assembled server-side.
    user_message_ids = [
        message["id"] for message in second_turn_messages if message["role"] == "user"
    ]
    assert user_message_ids == [_message_uuid("msg-user-1"), _message_uuid("msg-user-2")]
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
        title="Already titled",
        messages=persisted_messages,
    )

    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("new message", message_id=_message_uuid("msg-user-2")),
            lastMessageId=_message_uuid("msg-user-1"),
        ),
    )

    # The failure is surfaced to the client as an error chunk instead of the
    # connection closing silently.
    assert response.status_code == 200
    error_chunk = next(chunk for chunk in _stream_chunks(response.text) if chunk["type"] == "error")
    assert "model stream failed" in error_chunk["errorText"]

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
    tool_output = {
        "type": "tool-list_datasets",
        "toolCallId": tool_part["toolCallId"],
        "state": "output-available",
        "input": tool_part.get("input"),
        "output": {"datasets": []},
    }

    continuation_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            None,
            toolOutputs=[tool_output],
            lastMessageId=assistant_message_id,
        ),
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
                .order_by(models.AgentSessionMessage.id)
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


def _assistant_message_with_pending_client_tool() -> dict[str, Any]:
    """A persisted assistant tail whose client tool call never resolved — the
    transcript an interrupted browser leaves behind."""
    return {
        "id": _message_uuid("assistant-1"),
        "role": "assistant",
        "parts": [
            {"type": "text", "text": "Editing the prompt"},
            {
                "type": "tool-edit_prompt_instance",
                "toolCallId": "tool-call-pending",
                "state": "input-available",
                "input": {"instanceId": 3},
                "callProviderMetadata": {
                    "phoenix": {
                        "toolExecutionEnvironment": "client",
                        "toolInputEmittedAt": "2026-08-05T20:35:35+00:00",
                    }
                },
            },
        ],
    }


async def _load_pending_tool_part(
    db: DbSessionFactory,
) -> dict[str, Any]:
    async with db() as session:
        agent_session_rowid = await session.scalar(select(models.AgentSession.id))
        assert agent_session_rowid is not None
        stored_messages = await _load_session_messages(session, agent_session_rowid)
    assistant_message = next(
        message for message in stored_messages if message["id"] == _message_uuid("assistant-1")
    )
    return next(
        part for part in assistant_message["parts"] if part.get("toolCallId") == "tool-call-pending"
    )


async def test_user_turn_persists_interrupted_repair_for_dangling_client_tool(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "47474747-4747-4447-8447-474747474747"
    agent_session_id = await _create_agent_session_row(
        db,
        title="Already titled",
        messages=[
            _user_message("edit the prompt"),
            _assistant_message_with_pending_client_tool(),
        ],
    )

    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("what happened", message_id=_message_uuid("msg-user-2")),
            lastMessageId=_message_uuid("assistant-1"),
        ),
    )
    assert response.status_code == 200

    repaired_part = await _load_pending_tool_part(db)
    # Interruption is not a tool failure: the repair resolves the call as
    # neutral output describing the interruption, not as an error.
    assert repaired_part["state"] == "output-available"
    assert "interrupted" in repaired_part["output"]
    assert "client environment" in repaired_part["output"]
    # The original call's input and server-stamped metadata survive the repair.
    assert repaired_part["input"] == {"instanceId": 3}
    phoenix_metadata = repaired_part["callProviderMetadata"]["phoenix"]
    assert phoenix_metadata["toolExecutionEnvironment"] == "client"
    # pydantic-ai reads the outcome back from its metadata namespace on load.
    assert repaired_part["callProviderMetadata"]["pydantic_ai"]["outcome"] == "interrupted"


async def test_user_turn_applies_submitted_tool_output_error_resolutions(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "48484848-4848-4448-8448-484848484848"
    agent_session_id = await _create_agent_session_row(
        db,
        title="Already titled",
        messages=[
            _user_message("edit the prompt"),
            _assistant_message_with_pending_client_tool(),
        ],
    )

    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("never mind", message_id=_message_uuid("msg-user-2")),
            toolOutputs=[
                {
                    "type": "tool-edit_prompt_instance",
                    "toolCallId": "tool-call-pending",
                    "state": "output-error",
                    "input": {"instanceId": 3},
                    "errorText": "The user has interrupted this tool call.",
                    "callProviderMetadata": {
                        "phoenix": {
                            "toolExecutionEnvironment": "client",
                            "toolInputEmittedAt": "2026-08-05T20:35:35+00:00",
                        }
                    },
                }
            ],
            lastMessageId=_message_uuid("assistant-1"),
        ),
    )
    assert response.status_code == 200

    resolved_part = await _load_pending_tool_part(db)
    assert resolved_part["state"] == "output-error"
    assert resolved_part["errorText"] == "The user has interrupted this tool call."


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
        turn_trace_context=turn_trace_context,
        session_id="session-1",
        usage=RequestUsage(),
    ).message_metadata
    assert metadata is not None
    assert metadata.phoenix is not None
    assert metadata.phoenix.turn_trace_context == turn_trace_context


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
                "id": _message_uuid("user-1"),
                "role": "user",
                "parts": [{"type": "text", "text": "Use the tool"}],
            }
        ),
        UIMessage.model_validate(
            {
                "id": _message_uuid("assistant-1"),
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
                "id": _message_uuid("user-1"),
                "role": "user",
                "parts": [{"type": "text", "text": "Use the tool"}],
            }
        ),
        UIMessage.model_validate(
            {
                "id": _message_uuid("assistant-1"),
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


async def test_chat_stream_metadata_reuses_the_persisted_turn_trace_context(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A client-tool continuation resumes the turn identity persisted on the
    trailing assistant message's metadata instead of minting a new one."""
    trace_id = "931b2fbce00d0b18834637856fa72c7e"
    root_span_id = "f66a81825e150dc1"

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "11111111-1111-4111-8111-111111111111"
    assistant_tail = _assistant_message_with_pending_client_tool()
    assistant_tail["metadata"] = {
        "phoenix": {
            "type": "assistant",
            "sessionId": session_id,
            "turnTraceContext": {
                "traceId": trace_id,
                "rootSpanId": root_span_id,
                "startedAt": datetime.now(timezone.utc).isoformat(),
            },
        }
    }
    agent_session_id = await _create_agent_session_row(
        db,
        messages=[_user_message("edit the prompt"), assistant_tail],
    )

    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            None,
            toolOutputs=[
                {
                    "type": "tool-edit_prompt_instance",
                    "toolCallId": "tool-call-pending",
                    "state": "output-available",
                    "input": {"instanceId": 3},
                    "output": {"ok": True},
                }
            ],
            lastMessageId=assistant_tail["id"],
        ),
    )
    assert response.status_code == 200

    # The stream carries pydantic-ai's own metadata chunk too; the Phoenix one
    # is identified by its sessionId payload.
    phoenix_metadata_chunks = [
        chunk["messageMetadata"]
        for chunk in _stream_chunks(response.text)
        if chunk.get("type") == "message-metadata" and "phoenix" in chunk["messageMetadata"]
    ]
    assert len(phoenix_metadata_chunks) == 1
    assert phoenix_metadata_chunks[0]["phoenix"]["turnTraceContext"]["traceId"] == trace_id
    assert phoenix_metadata_chunks[0]["phoenix"]["turnTraceContext"]["rootSpanId"] == root_span_id

    async with db() as session:
        agent_session_rowid = await session.scalar(select(models.AgentSession.id))
        assert agent_session_rowid is not None
        stored_messages = await _load_session_messages(session, agent_session_rowid)
    assistant_messages = [message for message in stored_messages if message["role"] == "assistant"]
    assert assistant_messages
    persisted_turn_trace_context = assistant_messages[-1]["metadata"]["phoenix"]["turnTraceContext"]
    assert persisted_turn_trace_context["traceId"] == trace_id
    assert persisted_turn_trace_context["rootSpanId"] == root_span_id


async def test_chat_turn_without_a_message_is_rejected(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    """A submit request must carry the turn's new message."""
    session_id = "22222222-2222-4222-8222-222222222222"
    agent_session_id = await _create_agent_session_row(db)

    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(session_id, None),
    )
    assert response.status_code == 422

    async with db() as session:
        assert (await session.scalars(select(models.AgentSessionMessage))).all() == []


async def test_chat_turn_with_stale_last_message_id_is_rejected(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    """``lastMessageId`` is the send's optimistic-concurrency check: it must
    be omitted while the transcript is empty and must match the transcript's
    last persisted message once it isn't. A mismatch means the client is
    viewing a stale transcript and is rejected before any model work."""
    session_id = "23232323-2323-4323-8323-232323232323"
    agent_session_id = await _create_agent_session_row(
        db,
        title="Already titled",
        messages=[
            _user_message("earlier question"),
            {
                "id": _message_uuid("assistant-1"),
                "role": "assistant",
                "parts": [{"type": "text", "text": "earlier answer"}],
            },
        ],
    )

    # Omitted while the transcript is non-empty.
    omitted_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id, _user_message("follow-up", message_id=_message_uuid("msg-user-2"))
        ),
    )
    assert omitted_response.status_code == 409
    assert omitted_response.json() == {"code": "agent_session_messages_stale"}

    # Pointing at a message that is no longer the transcript's last.
    stale_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("follow-up", message_id=_message_uuid("msg-user-2")),
            lastMessageId=_message_uuid("msg-user-1"),
        ),
    )
    assert stale_response.status_code == 409
    assert stale_response.json() == {"code": "agent_session_messages_stale"}

    # A rejected send leaves the transcript untouched and the lock free.
    async with db() as session:
        stored = await session.scalar(select(models.AgentSession))
        assert stored is not None
        assert stored.heartbeat_at is None
        message_count = await session.scalar(
            select(func.count()).select_from(models.AgentSessionMessage)
        )
    assert message_count == 2


async def test_chat_turn_on_an_empty_session_rejects_a_last_message_id(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    """Providing ``lastMessageId`` against an empty transcript is stale too:
    the client believes messages exist that the server does not have."""
    session_id = "24242424-2424-4424-8424-242424242424"
    agent_session_id = await _create_agent_session_row(db)

    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("hello"),
            lastMessageId=_message_uuid("msg-user-0"),
        ),
    )
    assert response.status_code == 409
    assert response.json() == {"code": "agent_session_messages_stale"}


async def test_follow_up_send_from_a_compaction_message_passes_the_stale_check(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A compaction checkpoint is a regular transcript message: when it is the
    transcript's tail, its id is exactly what a follow-up send must present as
    ``lastMessageId`` — and the pre-compaction tail is stale."""

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "26262626-2626-4626-8626-262626262626"
    agent_session_id = await _create_agent_session_row(
        db,
        title="Already titled",
        messages=[
            _user_message("earlier question"),
            {
                "id": _message_uuid("assistant-1"),
                "role": "assistant",
                "parts": [{"type": "text", "text": "earlier answer"}],
            },
            {
                "id": _message_uuid("compaction-1"),
                "role": "user",
                "metadata": {
                    "phoenix": {
                        "type": "user",
                        "currentDateTime": "2026-01-01T00:00:00Z",
                        "timeZone": "UTC",
                        "isCompactionMessage": True,
                    }
                },
                "parts": [{"type": "text", "text": "Summary of the conversation so far."}],
            },
        ],
    )

    # The pre-compaction tail is no longer the transcript's last message.
    stale_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("follow-up", message_id=_message_uuid("msg-user-2")),
            lastMessageId=_message_uuid("assistant-1"),
        ),
    )
    assert stale_response.status_code == 409
    assert stale_response.json() == {"code": "agent_session_messages_stale"}

    # The compaction checkpoint is the valid follow-up point.
    follow_up_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("follow-up", message_id=_message_uuid("msg-user-2")),
            lastMessageId=_message_uuid("compaction-1"),
        ),
    )
    assert follow_up_response.status_code == 200


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
        "id": _message_uuid("assistant-1"),
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


def _parts_by_tool_call_id(message: PhoenixUIMessage) -> dict[str, Any]:
    return {
        tool_call_id: part
        for part in message.parts
        if (tool_call_id := getattr(part, "tool_call_id", None)) is not None
    }


def _tool_output(**overrides: Any) -> dict[str, Any]:
    return {
        "type": "tool-bash",
        "toolCallId": "tool-call-unresolved",
        "state": "output-available",
        "input": {"command": "ls"},
        "output": {"stdout": "README.md"},
        **overrides,
    }


def test_merge_appends_user_message_and_repairs_unresolved_tool_calls() -> None:
    persisted = _validated_messages(
        [_user_message("run a command"), _assistant_message_with_tool_states()]
    )

    merged = _merge_messages(
        old_messages=persisted,
        new_message=PhoenixUIMessage.model_validate(
            _user_message("never mind", message_id=_message_uuid("msg-user-2"))
        ),
    )

    assert [message.id for message in merged.messages] == [
        _message_uuid("msg-user-1"),
        _message_uuid("assistant-1"),
        _message_uuid("msg-user-2"),
    ]
    assert merged.continued_assistant_message is None
    repaired = merged.updated_messages[_message_uuid("assistant-1")]
    assert merged.messages[1] is repaired
    parts = _parts_by_tool_call_id(repaired)
    assert parts["tool-call-unresolved"].state == "output-available"
    assert "interrupted" in parts["tool-call-unresolved"].output
    interrupted_metadata = parts["tool-call-unresolved"].call_provider_metadata
    assert interrupted_metadata["pydantic_ai"]["outcome"] == "interrupted"
    assert parts["tool-call-streaming"].state == "output-available"
    # The genuinely completed call is left untouched — no interrupted outcome.
    assert parts["tool-call-done"].state == "output-available"
    assert parts["tool-call-done"].output == {"stdout": "/"}
    assert parts["tool-call-done"].call_provider_metadata is None


def test_repaired_interrupted_tools_load_with_interrupted_outcome() -> None:
    """Pin the contract with pydantic-ai's loader: a repaired interrupted call
    round-trips to ``ToolReturnPart(outcome='interrupted')`` — neutral, not a
    failure — while genuinely completed calls stay ``'success'``."""
    persisted = _validated_messages(
        [_user_message("run a command"), _assistant_message_with_tool_states()]
    )
    merged = _merge_messages(
        old_messages=persisted,
        new_message=PhoenixUIMessage.model_validate(
            _user_message("never mind", message_id=_message_uuid("msg-user-2"))
        ),
    )

    loaded = _to_pydantic_ai_messages(merged.messages)

    tool_returns = {
        part.tool_call_id: part
        for message in loaded
        for part in message.parts
        if isinstance(part, ToolReturnPart)
    }
    assert tool_returns["tool-call-unresolved"].outcome == "interrupted"
    assert tool_returns["tool-call-streaming"].outcome == "interrupted"
    assert tool_returns["tool-call-done"].outcome == "success"


def test_merge_applies_tool_outputs_to_the_trailing_assistant_message() -> None:
    persisted = _validated_messages(
        [_user_message("run a command"), _assistant_message_with_tool_states()]
    )

    merged = _merge_messages(
        old_messages=persisted,
        new_message=None,
        tool_outputs=[ToolOutputAvailablePart.model_validate(_tool_output())],
    )

    continued = merged.continued_assistant_message
    assert continued is not None
    assert continued.id == _message_uuid("assistant-1")
    assert merged.messages[-1] is continued
    assert set(merged.updated_messages) == {_message_uuid("assistant-1")}
    parts = _parts_by_tool_call_id(continued)
    assert parts["tool-call-unresolved"].state == "output-available"
    assert parts["tool-call-unresolved"].output == {"stdout": "README.md"}
    # The streaming call the outputs did not cover can never be resolved, so
    # it is authoritatively closed out as interrupted before the turn continues.
    assert parts["tool-call-streaming"].state == "output-available"
    streaming_metadata = parts["tool-call-streaming"].call_provider_metadata
    assert streaming_metadata["pydantic_ai"]["outcome"] == "interrupted"


def test_merge_ignores_tool_outputs_for_already_resolved_tool_calls() -> None:
    persisted = _validated_messages(
        [_user_message("run a command"), _assistant_message_with_tool_states()]
    )

    merged = _merge_messages(
        old_messages=persisted,
        new_message=None,
        tool_outputs=[
            ToolOutputAvailablePart.model_validate(_tool_output()),
            ToolOutputAvailablePart.model_validate(
                _tool_output(toolCallId="tool-call-done", output={"stdout": "overwritten"})
            ),
        ],
    )

    continued = merged.continued_assistant_message
    assert continued is not None
    parts = _parts_by_tool_call_id(continued)
    assert parts["tool-call-done"].output == {"stdout": "/"}


def test_merge_rejects_tool_outputs_that_match_no_tool_call() -> None:
    persisted = _validated_messages(
        [_user_message("run a command"), _assistant_message_with_tool_states()]
    )

    with pytest.raises(AgentSessionConflict) as exc_info:
        _merge_messages(
            old_messages=persisted,
            new_message=None,
            tool_outputs=[
                ToolOutputAvailablePart.model_validate(_tool_output(toolCallId="tool-call-missing"))
            ],
        )
    assert exc_info.value.code == "agent_session_tool_outputs_conflict"


def test_merge_rejects_tool_outputs_that_rename_the_tool() -> None:
    persisted = _validated_messages(
        [_user_message("run a command"), _assistant_message_with_tool_states()]
    )

    with pytest.raises(AgentSessionConflict) as exc_info:
        _merge_messages(
            old_messages=persisted,
            new_message=None,
            tool_outputs=[ToolOutputAvailablePart.model_validate(_tool_output(type="tool-python"))],
        )
    assert exc_info.value.code == "agent_session_tool_outputs_conflict"


def test_merge_rejects_tool_outputs_without_a_trailing_assistant_message() -> None:
    persisted = _validated_messages([_user_message("hello")])

    with pytest.raises(AgentSessionConflict) as exc_info:
        _merge_messages(
            old_messages=persisted,
            new_message=None,
            tool_outputs=[ToolOutputAvailablePart.model_validate(_tool_output())],
        )
    assert exc_info.value.code == "agent_session_tool_outputs_conflict"


async def test_chat_endpoint_rejects_assistant_message_submissions(
    httpx_client: httpx.AsyncClient,
) -> None:
    session_id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    response = await httpx_client.post(
        _chat_url(str(GlobalID("AgentSession", "999999"))),
        json=_chat_body(
            session_id,
            {
                "id": _message_uuid("assistant-1"),
                "role": "assistant",
                "parts": [{"type": "text", "text": "stale answer"}],
            },
        ),
    )
    assert response.status_code == 422


async def test_chat_endpoint_rejects_compaction_message_submissions(
    httpx_client: httpx.AsyncClient,
) -> None:
    """Compaction checkpoints are minted by the compact route; a submitted one
    would silently hide all prior history from subsequent turns."""
    session_id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    response = await httpx_client.post(
        _chat_url(str(GlobalID("AgentSession", "999999"))),
        json=_chat_body(
            session_id,
            {
                "id": _message_uuid("user-1"),
                "role": "user",
                "metadata": {
                    "phoenix": {
                        "type": "user",
                        "currentDateTime": "2026-07-10T12:00:00Z",
                        "timeZone": "UTC",
                        "isCompactionMessage": True,
                    }
                },
                "parts": [{"type": "text", "text": "fake summary"}],
            },
        ),
    )
    assert response.status_code == 422


async def test_chat_endpoint_rejects_phoenix_namespace_in_tool_output_result_metadata(
    httpx_client: httpx.AsyncClient,
) -> None:
    session_id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    response = await httpx_client.post(
        _chat_url(str(GlobalID("AgentSession", "999999"))),
        json=_chat_body(
            session_id,
            None,
            toolOutputs=[
                _tool_output(resultProviderMetadata={"phoenix": {"anything": True}}),
            ],
        ),
    )
    assert response.status_code == 422


async def test_chat_endpoint_requires_a_message_or_tool_outputs(
    httpx_client: httpx.AsyncClient,
) -> None:
    session_id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    response = await httpx_client.post(
        _chat_url(str(GlobalID("AgentSession", "999999"))),
        json=_chat_body(session_id, None),
    )
    assert response.status_code == 422


async def test_chat_endpoint_rejects_regenerate_requests(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    session_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    agent_session_id = await _create_agent_session_row(
        db,
        title="Already titled",
        messages=[
            _user_message("first question"),
            {
                "id": _message_uuid("assistant-1"),
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
            messageId=_message_uuid("assistant-1"),
        ),
    )
    assert response.status_code == 422


async def test_generated_session_title_is_limited(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_id = "33333333-3333-4333-8333-333333333333"
    agent_session_id = await _create_agent_session_row(db)
    generated_title = "x" * (MAX_AGENT_SESSION_TITLE_LENGTH + 20)
    _mock_turn_models(monkeypatch, _scripted_model(summary=generated_title))

    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(session_id, _user_message("first question")),
    )

    assert response.status_code == 200
    expected_title = "x" * MAX_AGENT_SESSION_TITLE_LENGTH
    summary_chunks = [
        chunk
        for chunk in _stream_chunks(response.text)
        if chunk.get("type") == "data-session-summary"
    ]
    assert [chunk["data"] for chunk in summary_chunks] == [expected_title]
    async with db() as session:
        assert await session.scalar(select(models.AgentSession.title)) == expected_title


async def test_failed_summary_leaves_session_untitled_until_a_later_turn(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failed first-turn summarization still persists the transcript but
    leaves the session untitled; the next turn retries summarization and the
    non-empty title then wins over the stored empty one."""
    session_id = "33333333-3333-4333-8333-333333333333"
    agent_session_id = await _create_agent_session_row(db)
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
            _user_message("second question", message_id=_message_uuid("msg-user-2")),
            lastMessageId=await _last_stored_message_id(db),
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
    agent_session_id = await _create_agent_session_row(db)
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
            _user_message("thanks", message_id=_message_uuid("msg-user-2")),
            lastMessageId=await _last_stored_message_id(db),
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
            _user_message("read it back", message_id=_message_uuid("msg-user-3")),
            lastMessageId=await _last_stored_message_id(db),
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
    agent_session_id = await _create_agent_session_row(db)

    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_headless_chat_body(session_id, _user_message("What datasets exist?")),
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
        _chat_url(agent_session_id),
        json=_headless_chat_body(
            session_id,
            _user_message("And experiments?", message_id=_message_uuid("msg-user-2")),
            lastMessageId=await _last_stored_message_id(db),
        ),
    )
    assert second_response.status_code == 200
    async with db() as session:
        second_turn_messages = await _load_session_messages(session, agent_session_rowid)
    user_message_ids = [
        message["id"] for message in second_turn_messages if message["role"] == "user"
    ]
    assert user_message_ids == [_message_uuid("msg-user-1"), _message_uuid("msg-user-2")]
    assert len(second_turn_messages) > len(messages)


async def test_server_agent_bash_shell_state_persists_across_chat_turns(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Mirror of ``test_bash_shell_state_persists_across_chat_turns`` for
    ``userAgentType="headless"``: pins the snapshot wiring ``build_server_agent``
    gained for the session route."""
    session_id = "57575757-5757-4757-8757-575757575757"
    agent_session_id = await _create_agent_session_row(db)
    note_path = "/home/user/workspace/note.txt"
    _mock_turn_models(
        monkeypatch,
        _scripted_model(bash_command=f"echo hello > {note_path}"),
        _scripted_model(bash_command=f"cat {note_path}"),
    )

    first_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_headless_chat_body(session_id, _user_message("write a note")),
    )
    assert first_response.status_code == 200
    async with db() as session:
        snapshots = (await session.scalars(select(models.AgentSessionSnapshot))).all()
        assert len(snapshots) == 1
        assert snapshots[0].bashkit_snapshot

    second_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_headless_chat_body(
            session_id,
            _user_message("read it back", message_id=_message_uuid("msg-user-2")),
            lastMessageId=await _last_stored_message_id(db),
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


async def test_headless_chat_is_forbidden_when_bash_is_disabled(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """``PHOENIX_AGENTS_DISABLE_BASH`` turns off the headless user agent on
    the chat route while leaving the web user agent available."""
    monkeypatch.setenv("PHOENIX_AGENTS_DISABLE_BASH", "true")

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "58585858-5858-4858-8858-585858585858"
    agent_session_id = await _create_agent_session_row(db)

    headless_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_headless_chat_body(session_id, _user_message("hello")),
    )
    assert headless_response.status_code == 403
    assert "Headless agent is disabled" in headless_response.text

    web_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(session_id, _user_message("hello")),
    )
    assert web_response.status_code == 200


# ---------------------------------------------------------------------------
# Session creation route
# ---------------------------------------------------------------------------


async def test_create_session_route_creates_a_temporary_session(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.post(
        "/v1/agent_sessions",
        json=_create_session_body(title=" CLI session ", is_ephemeral=True),
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
        assert agent_session.is_ephemeral is True
        assert agent_session.model_provider.value == "OPENAI"
        assert agent_session.model_name == "gpt-test"
        assert agent_session.custom_provider_id is None


async def test_create_session_route_defaults_to_a_persistent_untitled_session(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.post(
        "/v1/agent_sessions",
        json=_create_session_body(),
    )
    assert response.status_code == 201

    global_id = GlobalID.from_id(response.json()["data"]["id"])
    async with db() as session:
        agent_session = await session.get(models.AgentSession, int(global_id.node_id))
        assert agent_session is not None
        assert agent_session.title == ""
        assert agent_session.is_ephemeral is False


async def test_create_session_route_requires_a_model(
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.post("/v1/agent_sessions", json={})

    assert response.status_code == 422


async def test_create_session_route_rejects_long_title(
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.post(
        "/v1/agent_sessions",
        json=_create_session_body(title="x" * (MAX_AGENT_SESSION_TITLE_LENGTH + 1)),
    )

    assert response.status_code == 422


async def test_create_session_route_yields_a_chattable_session(
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The returned id is directly usable as the chat route's session id."""

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)

    created = await httpx_client.post(
        "/v1/agent_sessions",
        json=_create_session_body(is_ephemeral=True),
    )
    assert created.status_code == 201

    response = await httpx_client.post(
        _chat_url(created.json()["data"]["id"]),
        json=_headless_chat_body("11111111-1111-4111-8111-111111111111", _user_message("hello")),
    )
    assert response.status_code == 200


async def test_chat_runs_on_the_sessions_persisted_model_without_rewriting_it(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A turn whose asserted model matches the session runs on the persisted
    selection and leaves the session's model columns untouched — sending is
    never a model write."""
    built_selections = []

    async def _fake_build_model(selection: object, **kwargs: object) -> TestModel:
        built_selections.append(selection)
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    agent_session_id = await _create_agent_session_row(db)
    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            "11111111-1111-4111-8111-111111111111",
            _user_message("hello"),
        ),
    )

    assert response.status_code == 200
    assert built_selections == [
        BuiltInProviderModelSelection(
            provider_type="builtin",
            provider=ModelProvider.OPENAI,
            model_name="gpt-test",
        )
    ]
    global_id = GlobalID.from_id(agent_session_id)
    async with db() as session:
        agent_session = await session.get(models.AgentSession, int(global_id.node_id))
        assert agent_session is not None
        assert agent_session.model_provider.value == "OPENAI"
        assert agent_session.model_name == "gpt-test"
        assert agent_session.custom_provider_id is None


async def test_patch_session_route_moves_the_session_to_the_new_model(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The update route is the only way to change an existing session's model,
    and a turn asserting the new model is accepted once it has."""

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    agent_session_id = await _create_agent_session_row(db)
    next_model = {
        "providerType": "builtin",
        "provider": "ANTHROPIC",
        "modelName": "claude-opus-4-6",
    }

    response = await httpx_client.patch(
        _patch_session_url(agent_session_id), json={"model": next_model}
    )

    assert response.status_code == 200
    assert response.json()["data"]["model"]["provider"] == "ANTHROPIC"
    assert response.json()["data"]["model"]["modelName"] == "claude-opus-4-6"
    global_id = GlobalID.from_id(agent_session_id)
    async with db() as session:
        agent_session = await session.get(models.AgentSession, int(global_id.node_id))
        assert agent_session is not None
        assert agent_session.model_provider.value == "ANTHROPIC"
        assert agent_session.model_name == "claude-opus-4-6"

    # The session now answers to the new assertion, and no longer to the old.
    accepted = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            "11111111-1111-4111-8111-111111111111",
            _user_message("hello"),
            model=next_model,
        ),
    )
    assert accepted.status_code == 200


async def test_patch_session_route_rejects_a_deleted_custom_provider(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    agent_session_id = await _create_agent_session_row(db)
    deleted_provider_gid = str(GlobalID(models.GenerativeModelCustomProvider.__name__, "999"))

    response = await httpx_client.patch(
        _patch_session_url(agent_session_id),
        json={
            "model": {
                "providerType": "custom",
                "providerId": deleted_provider_gid,
                "modelName": "custom-model",
            }
        },
    )

    assert response.status_code == 404
    global_id = GlobalID.from_id(agent_session_id)
    async with db() as session:
        agent_session = await session.get(models.AgentSession, int(global_id.node_id))
        assert agent_session is not None
        assert agent_session.model_provider.value == "OPENAI"
        assert agent_session.model_name == "gpt-test"


async def test_patch_session_route_model_change_is_rejected_while_a_turn_holds_the_session_lock(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    """A streaming turn runs on the model it read under the turn lock, so the
    update route must not flip the session's model out from under it — and must
    not release the running turn's lock."""
    agent_session_id = await _create_agent_session_row(db)
    live_heartbeat = datetime.now(timezone.utc)
    async with db() as session:
        await session.execute(update(models.AgentSession).values(heartbeat_at=live_heartbeat))

    response = await httpx_client.patch(
        _patch_session_url(agent_session_id),
        json={
            "model": {
                "providerType": "builtin",
                "provider": "ANTHROPIC",
                "modelName": "claude-opus-4-6",
            }
        },
    )

    assert response.status_code == 409
    assert response.json() == {"code": "agent_session_busy"}
    async with db() as session:
        stored = await session.scalar(select(models.AgentSession))
        assert stored is not None
        assert stored.model_provider.value == "OPENAI"
        assert stored.model_name == "gpt-test"
        assert stored.heartbeat_at is not None


async def test_patch_session_route_ignores_a_stale_session_lock(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    """A heartbeat older than the staleness window belongs to an abandoned
    turn, so it must not wedge the session on its old model."""
    agent_session_id = await _create_agent_session_row(db)
    stale_heartbeat = datetime.now(timezone.utc) - TURN_LOCK_STALENESS * 2
    async with db() as session:
        await session.execute(update(models.AgentSession).values(heartbeat_at=stale_heartbeat))

    response = await httpx_client.patch(
        _patch_session_url(agent_session_id),
        json={
            "model": {
                "providerType": "builtin",
                "provider": "ANTHROPIC",
                "modelName": "claude-opus-4-6",
            }
        },
    )

    assert response.status_code == 200
    async with db() as session:
        stored = await session.scalar(select(models.AgentSession))
        assert stored is not None
        assert stored.model_provider.value == "ANTHROPIC"
        assert stored.model_name == "claude-opus-4-6"


async def test_patch_session_route_updates_the_title(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    agent_session_id = await _create_agent_session_row(db)

    response = await httpx_client.patch(
        _patch_session_url(agent_session_id),
        json={"title": "Renamed session"},
    )

    assert response.status_code == 200
    assert response.json()["data"]["title"] == "Renamed session"
    # The transcript is not part of the update payload.
    assert "messages" not in response.json()["data"]
    async with db() as session:
        stored = await session.scalar(select(models.AgentSession))
        assert stored is not None
        assert stored.title == "Renamed session"
        # An update that does not name the model leaves it unchanged.
        assert stored.model_provider.value == "OPENAI"
        assert stored.model_name == "gpt-test"


async def test_patch_session_route_rejects_an_empty_update(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    agent_session_id = await _create_agent_session_row(db)
    response = await httpx_client.patch(_patch_session_url(agent_session_id), json={})
    assert response.status_code == 422
    assert response.text == "No fields to update"


async def test_patch_session_route_rejects_explicit_null_fields(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    """Both fields are non-nullable: an explicit JSON null must 422 rather
    than be silently dropped like an omitted field."""
    agent_session_id = await _create_agent_session_row(db)

    response = await httpx_client.patch(
        _patch_session_url(agent_session_id),
        json={
            "title": None,
            "model": {
                "providerType": "builtin",
                "provider": "ANTHROPIC",
                "modelName": "claude-opus-4-6",
            },
        },
    )

    assert response.status_code == 422
    async with db() as session:
        stored = await session.scalar(select(models.AgentSession))
        assert stored is not None
        assert stored.model_provider.value == "OPENAI"


async def test_compact_rejects_a_request_asserting_a_model_the_session_is_not_on(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Compaction asserts the session's model the same way a turn does, so a
    stale client cannot have the summary generated by an unexpected model."""
    built_selections = []

    async def _fake_build_model(selection: object, **kwargs: object) -> TestModel:
        built_selections.append(selection)
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    agent_session_id = await _create_agent_session_row(db)

    response = await httpx_client.post(
        _compact_url(agent_session_id),
        json={
            "model": {
                "providerType": "builtin",
                "provider": "ANTHROPIC",
                "modelName": "claude-opus-4-6",
            }
        },
    )

    assert response.status_code == 409
    assert response.json() == {"code": "agent_session_model_stale"}
    assert built_selections == []
    # The rejected request must not leave the session's turn lock held.
    global_id = GlobalID.from_id(agent_session_id)
    async with db() as session:
        agent_session = await session.get(models.AgentSession, int(global_id.node_id))
        assert agent_session is not None
        assert agent_session.heartbeat_at is None


async def test_chat_rejects_a_turn_asserting_a_model_the_session_is_not_on(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A turn states the model it expects rather than setting one. When that
    assertion does not match the session's persisted selection the client is
    working from a stale view, so the send is refused instead of silently
    running on — or switching the session to — an unexpected model."""
    built_selections = []

    async def _fake_build_model(selection: object, **kwargs: object) -> TestModel:
        built_selections.append(selection)
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    agent_session_id = await _create_agent_session_row(db)
    deleted_provider_gid = str(GlobalID(models.GenerativeModelCustomProvider.__name__, "999"))
    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            "11111111-1111-4111-8111-111111111111",
            _user_message("hello"),
            model={
                "providerType": "custom",
                "providerId": deleted_provider_gid,
                "modelName": "custom-model",
            },
        ),
    )

    assert response.status_code == 409
    assert response.json() == {"code": "agent_session_model_stale"}
    # The turn never started, and the session keeps its own model.
    assert built_selections == []
    global_id = GlobalID.from_id(agent_session_id)
    async with db() as session:
        agent_session = await session.get(models.AgentSession, int(global_id.node_id))
        assert agent_session is not None
        assert agent_session.model_provider.value == "OPENAI"
        assert agent_session.model_name == "gpt-test"
        assert agent_session.custom_provider_id is None
        # The rejected send claimed the turn lock to read the model under it,
        # so it must hand the lock back rather than block the session until
        # the heartbeat goes stale.
        assert agent_session.heartbeat_at is None


async def test_chat_rejects_unknown_user_agent_types(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    agent_session_id = await _create_agent_session_row(db)
    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            "11111111-1111-4111-8111-111111111111",
            _user_message("hello"),
            userAgentType="nonexistent",
        ),
    )
    assert response.status_code == 422


async def test_create_session_route_is_forbidden_when_agents_are_disabled(
    app: FastAPI,
    httpx_client: httpx.AsyncClient,
) -> None:
    await app.state.system_settings.update_agent_assistant_enabled(
        AgentAssistantEnabledSetting(enabled=False)
    )

    response = await httpx_client.post(
        "/v1/agent_sessions",
        json=_create_session_body(),
    )
    assert response.status_code == 403
    assert "Agents are disabled" in response.text


async def test_create_session_route_is_not_gated_by_bash_disablement(
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sessions are agent-agnostic: only the chat route's headless user agent
    is turned off by ``PHOENIX_AGENTS_DISABLE_BASH``."""
    monkeypatch.setenv("PHOENIX_AGENTS_DISABLE_BASH", "true")

    response = await httpx_client.post(
        "/v1/agent_sessions",
        json=_create_session_body(),
    )
    assert response.status_code == 201


async def test_agents_router_is_forbidden_in_read_only_mode(
    app: FastAPI,
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    """Read-only mode turns off the whole agents router, chat included."""
    session_id = "77777777-7777-4777-8777-777777777777"
    agent_session_id = await _create_agent_session_row(db)
    app.state.read_only = True

    create_response = await httpx_client.post(
        "/v1/agent_sessions",
        json=_create_session_body(),
    )
    assert create_response.status_code == 403

    chat_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(session_id, _user_message("hello")),
    )
    assert chat_response.status_code == 403


# ---------------------------------------------------------------------------
# Trace ingestion
# ---------------------------------------------------------------------------


_PRIOR_TURN_TRACE_ID = "541221e156495558c48e177a21f84891"
_PRIOR_TURN_ROOT_SPAN_ID = "3789d49049f9d108"
_PRIOR_TURN_TIME = datetime(2026, 1, 1, tzinfo=timezone.utc)


async def _enable_local_trace_recording(app: FastAPI) -> None:
    await app.state.system_settings.update_agent_trace_recording(
        AgentTraceRecordingSetting(allow_local_traces=True)
    )


async def _ingest_prior_turn_trace(db: DbSessionFactory) -> None:
    """Simulate a prior request of the turn having already recorded the
    turn's root span."""
    async with db() as session:
        project = models.Project(name=get_env_phoenix_agents_assistant_project_name())
        session.add(project)
        await session.flush()
        prior_turn_trace = models.Trace(
            project_rowid=project.id,
            trace_id=_PRIOR_TURN_TRACE_ID,
            start_time=_PRIOR_TURN_TIME,
            end_time=_PRIOR_TURN_TIME,
        )
        prior_turn_trace.spans = [
            models.Span(
                span_id=_PRIOR_TURN_ROOT_SPAN_ID,
                parent_id=None,
                name="pxi.turn",
                span_kind="AGENT",
                start_time=_PRIOR_TURN_TIME,
                end_time=_PRIOR_TURN_TIME,
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
        session.add(prior_turn_trace)


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


def _assistant_tail_with_prior_turn_context(session_id: str) -> dict[str, Any]:
    """A persisted assistant tail carrying the turn identity a prior traced
    request minted, awaiting a client tool result."""
    tail = _assistant_message_with_pending_client_tool()
    tail["metadata"] = {
        "phoenix": {
            "type": "assistant",
            "sessionId": session_id,
            "turnTraceContext": {
                "traceId": _PRIOR_TURN_TRACE_ID,
                "rootSpanId": _PRIOR_TURN_ROOT_SPAN_ID,
                "startedAt": _PRIOR_TURN_TIME.isoformat(),
            },
        }
    }
    return tail


async def _post_traced_continuation_turn(
    httpx_client: httpx.AsyncClient,
    session_id: str,
    agent_session_id: str,
    *,
    last_message_id: str,
) -> httpx.Response:
    return await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            None,
            ingestTraces=True,
            toolOutputs=[
                {
                    "type": "tool-edit_prompt_instance",
                    "toolCallId": "tool-call-pending",
                    "state": "output-available",
                    "input": {"instanceId": 3},
                    "output": {"ok": True},
                    # The client echoes the call's phoenix metadata enriched
                    # with its execution timings; span synthesis keys off it.
                    "callProviderMetadata": {
                        "phoenix": {
                            "toolExecutionEnvironment": "client",
                            "toolInputEmittedAt": (
                                datetime.now(timezone.utc) - timedelta(seconds=30)
                            ).isoformat(),
                            "clientStartedAt": (
                                datetime.now(timezone.utc) - timedelta(seconds=20)
                            ).isoformat(),
                            "clientEndedAt": (
                                datetime.now(timezone.utc) - timedelta(seconds=10)
                            ).isoformat(),
                        }
                    },
                }
            ],
            lastMessageId=last_message_id,
        ),
    )


async def test_chat_turn_trace_ingestion_merges_backend_spans_into_prior_turn_trace(
    db: DbSessionFactory,
    app: FastAPI,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With trace ingestion enabled, a client-tool continuation resumes the
    turn identity persisted on the trailing assistant message, so its backend
    spans land in the turn's existing trace: no duplicate trace row, every span
    in the batch persisted under the existing root, the trace's time range
    widened, and the root's cumulative token counts updated."""
    await _enable_local_trace_recording(app)
    await _ingest_prior_turn_trace(db)
    _mock_traced_test_model(monkeypatch)
    session_id = "66666666-6666-4666-8666-666666666666"
    assistant_tail = _assistant_tail_with_prior_turn_context(session_id)
    agent_session_id = await _create_agent_session_row(
        db,
        messages=[_user_message("edit the prompt"), assistant_tail],
    )

    response = await _post_traced_continuation_turn(
        httpx_client,
        session_id,
        agent_session_id,
        last_message_id=assistant_tail["id"],
    )
    assert response.status_code == 200

    async with db() as session:
        traces = (
            await session.scalars(
                select(models.Trace).where(models.Trace.trace_id == _PRIOR_TURN_TRACE_ID)
            )
        ).all()
        assert len(traces) == 1
        merged_trace = traces[0]
        spans = (
            await session.scalars(
                select(models.Span)
                .join(models.Trace)
                .where(models.Trace.trace_id == _PRIOR_TURN_TRACE_ID)
            )
        ).all()

    backend_spans = [span for span in spans if span.span_id != _PRIOR_TURN_ROOT_SPAN_ID]
    # The continuation records the chat request and the session-title
    # summarization as LLM spans, plus a synthesized span for the client tool
    # result it delivered; all must survive the merge (a prior regression
    # dropped every other span in the batch).
    llm_spans = [span for span in backend_spans if span.span_kind == "LLM"]
    tool_spans = [span for span in backend_spans if span.span_kind == "TOOL"]
    assert len(llm_spans) >= 2
    assert len(tool_spans) == 1
    assert len(backend_spans) == len(llm_spans) + len(tool_spans)
    assert all(span.parent_id == _PRIOR_TURN_ROOT_SPAN_ID for span in backend_spans)

    prior_turn_root_span = next(span for span in spans if span.span_id == _PRIOR_TURN_ROOT_SPAN_ID)
    total_root_tokens = (
        prior_turn_root_span.cumulative_llm_token_count_prompt
        + prior_turn_root_span.cumulative_llm_token_count_completion
    )
    assert total_root_tokens > 0

    assert merged_trace.start_time == _PRIOR_TURN_TIME
    assert merged_trace.end_time > _PRIOR_TURN_TIME


async def test_new_user_message_closes_superseded_turn_trace(
    db: DbSessionFactory,
    app: FastAPI,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A turn that ends awaiting client tool outputs defers its root span to
    the continuation. When a new user message supersedes it instead, the
    deferred ``pxi.turn`` root and a synthesized span for the repaired tool
    call are emitted into the superseded trace, so its already-ingested
    child spans do not reference a root span id that never arrives."""
    await _enable_local_trace_recording(app)
    _mock_traced_test_model(monkeypatch)
    session_id = "67676767-6767-4667-8667-676767676767"
    assistant_tail = _assistant_tail_with_prior_turn_context(session_id)
    agent_session_id = await _create_agent_session_row(
        db,
        title="Already titled",
        messages=[_user_message("edit the prompt"), assistant_tail],
    )

    response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_id,
            _user_message("never mind, new topic", message_id=_message_uuid("msg-user-2")),
            ingestTraces=True,
            lastMessageId=assistant_tail["id"],
        ),
    )
    assert response.status_code == 200

    async with db() as session:
        spans = (
            await session.scalars(
                select(models.Span)
                .join(models.Trace)
                .where(models.Trace.trace_id == _PRIOR_TURN_TRACE_ID)
            )
        ).all()

    root = next(span for span in spans if span.parent_id is None)
    assert root.span_id == _PRIOR_TURN_ROOT_SPAN_ID
    assert root.name == "pxi.turn"
    assert root.status_code == "ERROR"
    tool_spans = [span for span in spans if span.span_kind == "TOOL"]
    assert len(tool_spans) == 1
    assert tool_spans[0].parent_id == _PRIOR_TURN_ROOT_SPAN_ID
    # The repaired call was interrupted, not failed: it renders neutrally.
    assert tool_spans[0].status_code == "OK"


async def test_chat_turn_trace_ingestion_links_project_session_without_orm_warnings(
    db: DbSessionFactory,
    app: FastAPI,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Merging backend spans into the turn's existing trace groups the trace
    under a project session keyed by the persisted agent session ID, without tripping
    SQLAlchemy's transient-object relationship warnings on autoflush."""
    await _enable_local_trace_recording(app)
    await _ingest_prior_turn_trace(db)
    _mock_traced_test_model(monkeypatch)
    session_id = "77777777-7777-4777-8777-777777777777"
    assistant_tail = _assistant_tail_with_prior_turn_context(session_id)
    agent_session_id = await _create_agent_session_row(
        db,
        messages=[_user_message("edit the prompt"), assistant_tail],
    )

    with warnings.catch_warnings():
        warnings.simplefilter("error", SAWarning)
        response = await _post_traced_continuation_turn(
            httpx_client,
            session_id,
            agent_session_id,
            last_message_id=assistant_tail["id"],
        )
        assert response.status_code == 200

    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        project_session = await session.scalar(
            select(models.ProjectSession).where(
                models.ProjectSession.session_id
                == get_otel_session_id(
                    project_name=agent_session.project_name,
                    agent_session_rowid=agent_session.id,
                )
            )
        )
        assert project_session is not None
        merged_trace = await session.scalar(
            select(models.Trace).where(models.Trace.trace_id == _PRIOR_TURN_TRACE_ID)
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
    session_request_id = "88888888-8888-4888-8888-888888888888"

    monkeypatch.setenv("PHOENIX_AGENTS_ASSISTANT_PROJECT_NAME", original_project_name)
    agent_session_id = await _create_agent_session_row(db)
    first_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_request_id,
            _user_message("first question"),
            ingestTraces=True,
        ),
    )
    assert first_response.status_code == 200

    monkeypatch.setenv("PHOENIX_AGENTS_ASSISTANT_PROJECT_NAME", changed_project_name)
    second_response = await httpx_client.post(
        _chat_url(agent_session_id),
        json=_chat_body(
            session_request_id,
            _user_message("second question", message_id=_message_uuid("msg-user-2")),
            lastMessageId=await _last_stored_message_id(db),
            ingestTraces=True,
        ),
    )
    assert second_response.status_code == 200

    assert tracer_project_names == [original_project_name, original_project_name]
    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        assert agent_session.project_name == original_project_name
        # Each user turn mints its own trace; both must land in the original
        # project's single project session.
        traces = (await session.scalars(select(models.Trace))).all()
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


async def test_chat_is_rejected_with_storage_guidance_when_writes_are_already_locked(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    """A locked database rejects the turn before it starts, with the reason."""
    session_id = "79797979-7979-4979-8979-797979797979"
    agent_session_id = await _create_agent_session_row(db, title="Already titled")

    db.should_not_insert_or_update = True
    try:
        response = await httpx_client.post(
            _chat_url(agent_session_id),
            json=_chat_body(session_id, _user_message("will be rejected")),
        )
    finally:
        db.should_not_insert_or_update = False

    assert response.status_code == 507
    assert insufficient_storage_message() in response.text


async def test_persisting_a_turn_for_a_deleted_session_fails(
    db: DbSessionFactory,
) -> None:
    agent_session_id = await _create_agent_session_row(db, title="Already titled")
    agent_session_rowid = int(GlobalID.from_id(agent_session_id).node_id)
    async with db() as session:
        agent_session = await session.get(models.AgentSession, agent_session_rowid)
        assert agent_session is not None
        await session.delete(agent_session)

    with pytest.raises(RuntimeError, match="no longer exists"):
        await _persist_agent_session_turn(
            db,
            agent_session_rowid=agent_session_rowid,
            user_id=None,
            new_messages=[PhoenixUIMessage.model_validate(_user_message("discarded"))],
            bashkit_snapshot=None,
        )


async def test_transcript_write_failure_is_reported_as_an_unsaved_turn(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A write that fails after the turn ran must not leak the driver's error.

    The stream handler puts whatever the persistence step raises straight into
    an error chunk, so a disk that fills mid-turn used to show the user a raw
    SQLAlchemy message.
    """

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)

    async def _failing_persist(*args: object, **kwargs: object) -> None:
        # The disk fills while the turn is streaming, i.e. after the route's
        # up-front `is_not_locked` check has already passed.
        db.should_not_insert_or_update = True
        raise RuntimeError("database or disk is full")

    monkeypatch.setattr(
        "phoenix.server.api.routers.agents._persist_agent_session_turn",
        _failing_persist,
    )
    session_id = "78787878-7878-4878-8878-787878787878"
    agent_session_id = await _create_agent_session_row(db, title="Already titled")

    try:
        response = await httpx_client.post(
            _chat_url(agent_session_id),
            json=_chat_body(session_id, _user_message("will not be saved")),
        )
    finally:
        db.should_not_insert_or_update = False

    assert response.status_code == 200
    error_chunk = next(chunk for chunk in _stream_chunks(response.text) if chunk["type"] == "error")
    assert "the conversation could not be saved" in error_chunk["errorText"]
    # Storage is the actionable cause, so it is named alongside the notice.
    assert insufficient_storage_message() in error_chunk["errorText"]
    # The raw driver text is not what the user reads.
    assert "database or disk is full" not in error_chunk["errorText"]
    assert "data-transcript-persisted" not in response.text


async def test_client_disconnect_persists_partial_turn(
    db: DbSessionFactory,
    asgi_app: ASGIApp,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Interrupting a streaming turn — the UI stop button, a CLI interrupt, or
    a dropped SSE connection — persists the partial turn and releases the turn
    lock, so clients can reload the transcript and resume with a follow-up
    message instead of snapping back to the pre-turn state."""

    async def stream_function(
        messages: list[ModelMessage],
        agent_info: AgentInfo,
    ) -> AsyncIterator[str | DeltaToolCalls]:
        yield "partial "
        yield "answer"
        # Stream forever: only the client's disconnect ends this turn.
        await asyncio.Event().wait()

    def function(messages: list[ModelMessage], agent_info: AgentInfo) -> ModelResponse:
        raise AssertionError("the interrupted turn never completes a non-streamed call")

    _mock_turn_models(
        monkeypatch,
        FunctionModel(function=function, stream_function=stream_function),
    )
    session_id = "17171717-1717-4717-8717-171717171717"
    agent_session_id = await _create_agent_session_row(db, title="Already titled")
    request_body = json.dumps(
        _chat_body(session_id, _user_message("interrupt me", message_id=_message_uuid("stop-1")))
    ).encode()

    # Drive the ASGI app directly: httpx's ASGI transport cannot emit the
    # mid-stream `http.disconnect` that a stop button or Ctrl-C produces.
    disconnected = asyncio.Event()
    request_sent = False

    async def receive() -> dict[str, Any]:
        nonlocal request_sent
        if not request_sent:
            request_sent = True
            return {"type": "http.request", "body": request_body, "more_body": False}
        await disconnected.wait()
        return {"type": "http.disconnect"}

    streamed = bytearray()

    async def send(message: MutableMapping[str, Any]) -> None:
        if message["type"] == "http.response.body":
            streamed.extend(message.get("body", b""))
            if b'"text-delta"' in streamed:
                # The client saw some of the reply; hang up mid-stream.
                disconnected.set()

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": _chat_url(agent_session_id),
        "raw_path": _chat_url(agent_session_id).encode(),
        "query_string": b"",
        "root_path": "",
        "headers": [
            (b"host", b"test"),
            (b"accept", b"text/event-stream"),
            (b"content-type", b"application/json"),
            (b"content-length", str(len(request_body)).encode()),
        ],
        "client": ("testclient", 50000),
        "server": ("test", 80),
        "state": {},
    }
    await asyncio.wait_for(asgi_app(scope, receive, send), timeout=30)

    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        # The interrupted turn released its lock, so a follow-up can claim it.
        assert agent_session.heartbeat_at is None
        messages = await _load_session_messages(session, agent_session.id)

    assert [message["role"] for message in messages] == ["user", "assistant"]
    assistant_message = messages[-1]
    text_parts = [part for part in assistant_message["parts"] if part["type"] == "text"]
    assert len(text_parts) == 1
    # The text streamed before the disconnect is kept and finalized.
    assert text_parts[0]["text"].startswith("partial")
    assert text_parts[0]["state"] == "done"
    # The persisted message is flagged interrupted so clients can render the
    # cut-off turn distinctly (including when no parts streamed at all).
    assert assistant_message["metadata"]["phoenix"]["type"] == "assistant"
    assert assistant_message["metadata"]["phoenix"]["interrupted"] is True
    # The persisted transcript round-trips through submit validation for resume.
    for message in messages:
        PhoenixUIMessage.model_validate(message)
    # The assistant message keeps the stream's opening message id, so the
    # client's next send passes the `lastMessageId` staleness check.
    chunks = _stream_chunks(streamed.decode())
    start_chunk = next(chunk for chunk in chunks if chunk.get("type") == "start")
    assert assistant_message["id"] == start_chunk["messageId"]
    assert await _last_stored_message_id(db) == assistant_message["id"]
