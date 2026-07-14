"""Behavioral tests for the agents router.

Every test drives the public chat route
asserts on observable outcomes: the chunks emitted on the stream and the rows
persisted to the database. The LLM is the only mocked seam (``build_model``).
"""

import json
import warnings
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.sdk.trace import TracerProvider
from pydantic_ai.messages import ModelMessage, ModelResponse, ToolCallPart, ToolReturnPart
from pydantic_ai.models.function import AgentInfo, DeltaToolCall, DeltaToolCalls, FunctionModel
from pydantic_ai.models.test import TestModel
from sqlalchemy import select
from sqlalchemy.exc import SAWarning

from phoenix.config import get_env_phoenix_agents_assistant_project_name
from phoenix.db import models
from phoenix.server.agents.pydantic_ai import OpenInferenceModelWrapper
from phoenix.server.api.routers.agents import AssistantMetadataUIMessage
from phoenix.server.settings.registry import AgentTraceRecordingSetting
from phoenix.server.types import DbSessionFactory

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
        messages = agent_session.messages
        # No bash command this turn, so no shell-state snapshot row.
        assert await session.scalar(select(models.AgentSessionSnapshot)) is None

    assert messages[0]["role"] == "user"
    assistant_messages = [message for message in messages if message["role"] == "assistant"]
    assert assistant_messages
    metadata = assistant_messages[-1]["metadata"]
    assert metadata["sessionId"] == session_id
    assert metadata["usage"]["tokens"]["total"] > 0
    # Resuming a session sends the persisted transcript back through the chat
    # request's message validation, so every stored message must round-trip.
    for message in messages:
        AssistantMetadataUIMessage.model_validate(message)

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


async def test_chat_stream_metadata_uses_propagated_trace_context(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When the browser propagates its trace context via ``traceparent``, the
    turn's message-metadata chunk (and the persisted assistant message) carry
    the browser's trace and root span ids."""
    trace_id = "931b2fbce00d0b18834637856fa72c7e"
    root_span_id = "f66a81825e150dc1"

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "11111111-1111-4111-8111-111111111111"

    response = await httpx_client.post(
        _chat_url(session_id),
        json=_chat_body(session_id, [_user_message("hello")]),
        headers={"traceparent": f"00-{trace_id}-{root_span_id}-01"},
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
        stored_messages = await session.scalar(
            select(models.AgentSession.messages).where(models.AgentSession.session_id == session_id)
        )
    assert stored_messages is not None
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
        stored_messages = agent_sessions[0].messages
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
        assert len(agent_sessions[0].messages) > len(stored_messages)


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
        first_snapshot = snapshots[0].bashkit_snapshot
        assert first_snapshot
        stored_messages = (
            await session.scalar(
                select(models.AgentSession.messages).where(
                    models.AgentSession.session_id == session_id
                )
            )
        ) or []

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
        assert snapshots[0].bashkit_snapshot == first_snapshot
        stored_messages = (
            await session.scalar(
                select(models.AgentSession.messages).where(
                    models.AgentSession.session_id == session_id
                )
            )
        ) or []

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
        ),
        headers={"traceparent": f"00-{_BROWSER_TRACE_ID}-{_BROWSER_ROOT_SPAN_ID}-01"},
    )


async def test_chat_turn_trace_ingestion_merges_backend_spans_into_browser_trace(
    db: DbSessionFactory,
    app: FastAPI,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With trace ingestion enabled and the browser's trace context propagated,
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
