import warnings
from datetime import datetime, timezone
from typing import Any

import httpx
import pytest
from pydantic_ai import RunUsage
from pydantic_ai.models.test import TestModel
from sqlalchemy import func, select
from sqlalchemy.exc import SAWarning

from phoenix.db import models
from phoenix.server.api.routers.agents import (
    AssistantMetadataUIMessage,
    _build_message_metadata_chunk,
    _get_span_context,
    _load_bash_snapshot,
    _persist_agent_session_turn,
    _persist_db_traces,
    _upsert_agent_session,
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


# ---------------------------------------------------------------------------
# Agent session persistence
# ---------------------------------------------------------------------------


def _user_message(text: str, *, message_id: str = "msg-user-1") -> dict[str, Any]:
    return {
        "id": message_id,
        "role": "user",
        "parts": [{"type": "text", "text": text}],
    }


async def test_persist_agent_session_turn_round_trip(db: DbSessionFactory) -> None:
    session_id = "11111111-1111-4111-8111-111111111111"
    first_turn = [_user_message("first question")]
    await _persist_agent_session_turn(
        db,
        session_id=session_id,
        user_id=None,
        messages=first_turn,
        bashkit_snapshot=b"shell-state-1",
    )
    second_turn: list[dict[str, Any]] = [
        *first_turn,
        {"id": "m2", "role": "assistant", "parts": []},
    ]
    await _persist_agent_session_turn(
        db,
        session_id=session_id,
        user_id=None,
        messages=second_turn,
        bashkit_snapshot=None,
    )

    async with db() as session:
        agent_sessions = (await session.scalars(select(models.AgentSession))).all()
        assert len(agent_sessions) == 1
        agent_session = agent_sessions[0]
        assert agent_session.session_id == session_id
        # No LLM title was supplied, so the session stays untitled; the
        # frontend renders its own display fallback.
        assert agent_session.title == ""
        assert agent_session.messages == second_turn
        snapshots = (await session.scalars(select(models.AgentSessionSnapshot))).all()
        assert len(snapshots) == 1
        # A turn without bash activity leaves the stored shell state intact.
        stored = await _load_bash_snapshot(session, agent_session_rowid=agent_session.id)
        assert stored == b"shell-state-1"

    third_turn: list[dict[str, Any]] = [
        *second_turn,
        {"id": "m3", "role": "assistant", "parts": []},
    ]
    await _persist_agent_session_turn(
        db,
        session_id=session_id,
        user_id=None,
        messages=third_turn,
        bashkit_snapshot=b"shell-state-2",
    )
    async with db() as session:
        # A turn with bash activity overwrites the session's single snapshot
        # row in place.
        snapshots = (await session.scalars(select(models.AgentSessionSnapshot))).all()
        assert len(snapshots) == 1
        assert snapshots[0].bashkit_snapshot == b"shell-state-2"


async def test_persist_agent_session_turn_skips_empty_transcript(db: DbSessionFactory) -> None:
    await _persist_agent_session_turn(
        db,
        session_id="22222222-2222-4222-8222-222222222222",
        user_id=None,
        messages=[],
        bashkit_snapshot=b"ignored",
    )
    async with db() as session:
        assert (await session.scalars(select(models.AgentSession))).all() == []


async def test_upsert_agent_session_title_conflict_semantics(db: DbSessionFactory) -> None:
    session_id = "33333333-3333-4333-8333-333333333333"
    async with db() as session:
        await _upsert_agent_session(
            session,
            session_id=session_id,
            user_id=None,
            title="",
            messages=[_user_message("original transcript")],
        )
    async with db() as session:
        # A non-empty title always wins on conflict.
        await _upsert_agent_session(
            session,
            session_id=session_id,
            user_id=None,
            title="LLM title",
        )
        row = await session.scalar(select(models.AgentSession))
        assert row is not None
        assert row.title == "LLM title"
        # Omitting messages leaves the stored transcript alone.
        assert row.messages == [_user_message("original transcript")]
    async with db() as session:
        # An empty title never clobbers a stored one.
        await _upsert_agent_session(
            session,
            session_id=session_id,
            user_id=None,
            title="",
        )
        row = await session.scalar(select(models.AgentSession))
        assert row is not None
        assert row.title == "LLM title"


async def test_persist_agent_session_turn_prefers_provided_title(db: DbSessionFactory) -> None:
    await _persist_agent_session_turn(
        db,
        session_id="55555555-5555-4555-8555-555555555555",
        user_id=None,
        messages=[_user_message("first question")],
        bashkit_snapshot=None,
        title="LLM summary",
    )
    async with db() as session:
        row = await session.scalar(select(models.AgentSession))
        assert row is not None
        assert row.title == "LLM summary"


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

    monkeypatch.setattr(
        "phoenix.server.api.routers.agents.build_model",
        _fake_build_model,
    )
    session_id = "44444444-4444-4444-8444-444444444444"
    body = {
        "trigger": "submit-message",
        "id": session_id,
        "messages": [_user_message("What datasets exist?")],
        "model": {
            "providerType": "builtin",
            "provider": "OPENAI",
            "modelName": "gpt-test",
        },
    }

    response = await httpx_client.post(
        f"/agents/assistant/sessions/{session_id}/chat",
        json=body,
    )
    assert response.status_code == 200
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
        f"/agents/assistant/sessions/{session_id}/chat",
        json={
            **body,
            "messages": [
                *messages,
                _user_message("And experiments?", message_id="msg-user-2"),
            ],
        },
    )
    assert second_response.status_code == 200
    # Only a session's first turn summarizes; later turns keep the stored title.
    assert "data-session-summary" not in second_response.text
    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        assert agent_session.title == "a"


async def test_get_agent_session_messages_returns_transcript(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    transcript: list[dict[str, Any]] = [
        _user_message("first"),
        {"id": "m2", "role": "assistant", "parts": [{"type": "text", "text": "reply"}]},
    ]
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        session.add(
            models.AgentSession(
                session_id="with-transcript",
                user_id=None,
                title="session title",
                messages=transcript,
                created_at=now,
                updated_at=now,
            )
        )

    response = await httpx_client.get("/agents/assistant/sessions/with-transcript/messages")
    assert response.status_code == 200
    assert response.json()["data"] == transcript

    missing = await httpx_client.get("/agents/assistant/sessions/nonexistent/messages")
    assert missing.status_code == 404

    unknown_agent = await httpx_client.get("/agents/other/sessions/with-transcript/messages")
    assert unknown_agent.status_code == 404
