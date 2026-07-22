"""HTTP-level tests pinning the deprecated ``/agents/server/sessions/{id}/chat``
contract used by published CLI clients (``@arizeai/phoenix-cli`` <= 1.10.x).

These clients mint their own UUID session id and POST the full Vercel-AI
``messages`` transcript each turn, so the legacy route must keep accepting
that shape — statelessly, persisting nothing — until the deprecation window
closes.
"""

import json
from typing import Any

import httpx
import pytest
from pydantic_ai.models.test import TestModel
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.config import get_env_phoenix_agents_assistant_project_name
from phoenix.db import models
from phoenix.server.types import DbSessionFactory

_LEGACY_BUILD_MODEL_PATCH_TARGET = "phoenix.server.api.routers.legacy_agents.build_model"
_BUILD_MODEL_PATCH_TARGET = "phoenix.server.api.routers.agents.build_model"

_CLIENT_MINTED_SESSION_ID = "12345678-1234-4123-8123-123456789012"


def _user_message(text: str, *, message_id: str = "msg-user-1") -> dict[str, Any]:
    return {
        "id": message_id,
        "role": "user",
        "parts": [{"type": "text", "text": text}],
    }


def _legacy_chat_body(messages: list[dict[str, Any]], **overrides: Any) -> dict[str, Any]:
    """The wire shape published CLIs send: full transcript, no session row."""
    return {
        "trigger": "submit-message",
        "id": _CLIENT_MINTED_SESSION_ID,
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


def _mock_legacy_model(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_LEGACY_BUILD_MODEL_PATCH_TARGET, _fake_build_model)


async def test_legacy_chat_route_streams_a_turn_for_a_client_owned_transcript(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An old-shape request (full ``messages`` array, client-minted UUID
    session id, no pre-created session row) streams a Vercel-AI response."""
    _mock_legacy_model(monkeypatch)

    response = await httpx_client.post(
        f"/agents/server/sessions/{_CLIENT_MINTED_SESSION_ID}/chat",
        json=_legacy_chat_body([_user_message("What datasets exist?")]),
    )

    assert response.status_code == 200
    assert response.headers.get("deprecation") == "true"
    chunks = _stream_chunks(response.text)
    chunk_types = {chunk["type"] for chunk in chunks}
    assert "start" in chunk_types
    assert "text-delta" in chunk_types
    assert "finish" in chunk_types
    # The Phoenix metadata chunk echoes the client-minted session id.
    phoenix_metadata_chunks = [
        chunk["messageMetadata"]
        for chunk in chunks
        if chunk.get("type") == "message-metadata" and "sessionId" in chunk["messageMetadata"]
    ]
    assert phoenix_metadata_chunks
    assert phoenix_metadata_chunks[-1]["sessionId"] == _CLIENT_MINTED_SESSION_ID
    assert phoenix_metadata_chunks[-1]["usage"]["tokens"]["total"] > 0


async def test_legacy_chat_route_is_stateless(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Old clients own their transcripts: a legacy turn persists no session
    rows and emits none of the persistence chunks of the new contract."""
    _mock_legacy_model(monkeypatch)

    response = await httpx_client.post(
        f"/agents/server/sessions/{_CLIENT_MINTED_SESSION_ID}/chat",
        json=_legacy_chat_body([_user_message("hello")]),
    )

    assert response.status_code == 200
    assert "data-transcript-persisted" not in response.text
    assert "data-session-summary" not in response.text
    async with db() as session:
        assert (await session.scalars(select(models.AgentSession))).all() == []
        assert (await session.scalars(select(models.AgentSessionMessage))).all() == []


async def test_legacy_chat_route_accepts_a_multi_turn_transcript(
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Later turns resend the whole conversation, including assistant
    messages bearing the metadata the server previously streamed."""
    _mock_legacy_model(monkeypatch)
    transcript = [
        _user_message("first question"),
        {
            "id": "assistant-1",
            "role": "assistant",
            "parts": [{"type": "text", "text": "first answer"}],
            "metadata": {
                "sessionId": _CLIENT_MINTED_SESSION_ID,
                "usage": {"tokens": {"prompt": 1, "completion": 2, "total": 3}},
            },
        },
        _user_message("second question", message_id="msg-user-2"),
    ]

    response = await httpx_client.post(
        f"/agents/server/sessions/{_CLIENT_MINTED_SESSION_ID}/chat",
        json=_legacy_chat_body(transcript),
    )

    assert response.status_code == 200
    assert "text-delta" in {chunk["type"] for chunk in _stream_chunks(response.text)}


async def test_new_chat_route_is_unaffected_by_the_legacy_registration(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The legacy router registers first so /agents/server/... isn't captured
    by /agents/{agent_id}/...; the new route must keep working alongside it."""

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "99999999-9999-4999-8999-999999999999"
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id=session_id,
            user_id=None,
            title="Already titled",
            project_name=get_env_phoenix_agents_assistant_project_name(),
        )
        session.add(agent_session)
        await session.flush()
        agent_session_id = str(GlobalID("AgentSession", str(agent_session.id)))

    response = await httpx_client.post(
        f"/agents/assistant/sessions/{agent_session_id}/chat",
        json={
            "trigger": "submit-message",
            "id": session_id,
            "message": _user_message("hello"),
            "model": {
                "providerType": "builtin",
                "provider": "OPENAI",
                "modelName": "gpt-test",
            },
        },
    )

    assert response.status_code == 200
    assert "deprecation" not in response.headers
    assert "data-transcript-persisted" in response.text


async def test_new_contract_body_on_the_server_agent_url_delegates_to_the_session_handler(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:

    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    # The delegated turn runs in the session handler, so its model seam —
    # not the legacy route's — is the one in play.
    monkeypatch.setattr(_BUILD_MODEL_PATCH_TARGET, _fake_build_model)
    session_id = "13131313-1313-4313-8313-131313131313"
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id=session_id,
            user_id=None,
            title="Already titled",
            project_name=get_env_phoenix_agents_assistant_project_name(),
        )
        session.add(agent_session)
        await session.flush()
        agent_session_id = str(GlobalID("AgentSession", str(agent_session.id)))

    response = await httpx_client.post(
        f"/agents/server/sessions/{agent_session_id}/chat",
        json={
            "trigger": "submit-message",
            "id": session_id,
            "message": _user_message("hello"),
            "model": {
                "providerType": "builtin",
                "provider": "OPENAI",
                "modelName": "gpt-test",
            },
        },
    )

    assert response.status_code == 200
    assert "deprecation" not in response.headers
    assert "data-transcript-persisted" in response.text
    async with db() as session:
        assert (await session.scalars(select(models.AgentSessionMessage))).all()


async def test_unknown_agent_id_still_returns_not_found(
    httpx_client: httpx.AsyncClient,
) -> None:
    """Only the literal ``server`` segment maps to the legacy route; other
    unknown agent ids keep 404ing in the new handler."""
    response = await httpx_client.post(
        f"/agents/other/sessions/{_CLIENT_MINTED_SESSION_ID}/chat",
        json={
            "trigger": "submit-message",
            "id": _CLIENT_MINTED_SESSION_ID,
            "message": _user_message("hello"),
            "model": {
                "providerType": "builtin",
                "provider": "OPENAI",
                "modelName": "gpt-test",
            },
        },
    )
    assert response.status_code == 404
