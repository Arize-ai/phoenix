import json
from typing import Any

import httpx
import pytest

from evals.harbor.container_assets.chat_client import (
    AgentSessionChatClient,
    SessionConflict,
    StreamError,
    accumulate_assistant_message,
    answer_text,
    builtin_model_selection,
    count_tool_calls,
    parse_chunk,
    parse_json_answer,
)
from phoenix.server.api.routers.agents import ChatRequestBody, CreateAgentSessionRequestBody

SESSION_ID = "QWdlbnRTZXNzaW9uOjE="


def _sse(chunks: list[dict[str, Any]]) -> str:
    return "".join(f"data: {json.dumps(chunk)}\n\n" for chunk in chunks) + "data: [DONE]\n\n"


def _text_turn(message_id: str, text: str) -> list[dict[str, Any]]:
    return [
        {"type": "start", "messageId": message_id},
        {"type": "start-step"},
        {"type": "text-start", "id": "t1"},
        {"type": "text-delta", "id": "t1", "delta": text},
        {"type": "text-end", "id": "t1"},
        {"type": "finish-step"},
        {"type": "finish"},
    ]


def _approval_turn(message_id: str) -> list[dict[str, Any]]:
    return [
        {"type": "start", "messageId": message_id},
        {"type": "start-step"},
        {
            "type": "tool-input-available",
            "toolCallId": "call-1",
            "toolName": "create_split",
            "input": {"name": "regressed"},
            "dynamic": True,
        },
        {"type": "tool-approval-request", "approvalId": "approval-1", "toolCallId": "call-1"},
        {"type": "finish-step"},
        {"type": "finish"},
    ]


class FakePhoenix:
    """Enough of the agent session routes to exercise the client's turn loop."""

    def __init__(self, streams: list[list[dict[str, Any]]]) -> None:
        self.streams = list(streams)
        self.transcript: list[dict[str, Any]] = []
        self.chat_bodies: list[dict[str, Any]] = []
        self.busy_responses_remaining = 0

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/v1/agent_sessions" and request.method == "POST":
            return httpx.Response(200, json={"data": {"id": SESSION_ID}})
        if path == f"/v1/agent_sessions/{SESSION_ID}/messages":
            return httpx.Response(200, json={"data": self.transcript, "next_cursor": None})
        if path == f"/v1/agent_sessions/{SESSION_ID}/chat":
            if self.busy_responses_remaining:
                self.busy_responses_remaining -= 1
                return httpx.Response(
                    409, json={"code": "agent_session_busy", "message": "turn in progress"}
                )
            body = json.loads(request.content)
            self.chat_bodies.append(body)
            expected_last_id = self.transcript[-1]["id"] if self.transcript else None
            if body.get("lastMessageId") != expected_last_id:
                return httpx.Response(
                    409, json={"code": "agent_session_messages_stale", "message": "stale"}
                )
            if (message := body.get("message")) is not None:
                self.transcript.append(message)
            chunks = self.streams.pop(0)
            if body.get("toolApprovals"):
                self.transcript.pop()
            self.transcript.append({"id": chunks[0]["messageId"], "role": "assistant", "parts": []})
            return httpx.Response(
                200, headers={"content-type": "text/event-stream"}, text=_sse(chunks)
            )
        return httpx.Response(404, json={"detail": f"unexpected {request.method} {path}"})


def _client(fake: FakePhoenix) -> AgentSessionChatClient:
    return AgentSessionChatClient(
        "http://phoenix.test",
        model=builtin_model_selection("anthropic/claude-sonnet-4-5"),
        transport=httpx.MockTransport(fake.handler),
    )


def test_builtin_model_selection_maps_harbor_provider() -> None:
    assert builtin_model_selection("anthropic/claude-sonnet-4-5") == {
        "provider_type": "builtin",
        "provider": "ANTHROPIC",
        "model_name": "claude-sonnet-4-5",
    }
    with pytest.raises(ValueError, match="provider/model"):
        builtin_model_selection("no-slash")


async def test_run_turn_streams_a_text_reply() -> None:
    fake = FakePhoenix([_text_turn("a1", 'Done.\n```json\n{"x": 1}\n```')])
    client = _client(fake)
    session_id = await client.create_session()
    turn = await client.run_turn(
        session_id,
        "hello",
        edit_permission="manual",
        mutations_enabled=False,
        approve=lambda _: False,
    )
    await client.aclose()

    body = fake.chat_bodies[0]
    # The request dicts are hand-mirrored from the CLI; validate them against the
    # server's own models so drift fails here rather than at run time.
    CreateAgentSessionRequestBody.model_validate(
        {"model": builtin_model_selection("anthropic/claude-sonnet-4-5"), "is_ephemeral": False}
    )
    ChatRequestBody.model_validate(body)
    assert body["headless"] is True
    assert body["lastMessageId"] is None
    assert body["message"]["role"] == "user"
    assert body["message"]["parts"] == [{"type": "text", "text": "hello"}]
    assert {context["type"] for context in body["contexts"]} == {
        "app",
        "graphql",
        "web_access",
        "subagents",
    }
    assert turn.final_message["id"] == "a1"
    assert parse_json_answer(answer_text(turn.final_message)) == {"x": 1}
    assert count_tool_calls(turn.assistant_messages) == 0


async def test_run_turn_answers_approvals_until_the_turn_settles() -> None:
    fake = FakePhoenix([_approval_turn("a1"), _text_turn("a1", "Created the split.")])
    client = _client(fake)
    session_id = await client.create_session()
    turn = await client.run_turn(
        session_id,
        "create a split",
        edit_permission="manual",
        mutations_enabled=True,
        approve=lambda part: part["toolName"] == "create_split",
    )
    await client.aclose()

    approval_body = fake.chat_bodies[1]
    ChatRequestBody.model_validate(approval_body)
    assert "message" not in approval_body
    assert approval_body["toolApprovals"] == [{"toolCallId": "call-1", "approved": True}]
    assert approval_body["lastMessageId"] == "a1"
    assert len(turn.assistant_messages) == 2
    assert count_tool_calls(turn.assistant_messages) == 1


async def test_run_turn_sends_the_persisted_tail_as_last_message_id() -> None:
    fake = FakePhoenix([_text_turn("a1", "one"), _text_turn("a2", "two")])
    client = _client(fake)
    session_id = await client.create_session()
    for instruction in ("first", "second"):
        await client.run_turn(
            session_id,
            instruction,
            edit_permission="manual",
            mutations_enabled=False,
            approve=lambda _: False,
        )
    await client.aclose()
    assert fake.chat_bodies[1]["lastMessageId"] == "a1"


async def test_run_turn_retries_while_the_session_is_busy() -> None:
    fake = FakePhoenix([_text_turn("a1", "ok")])
    fake.busy_responses_remaining = 1
    client = _client(fake)
    session_id = await client.create_session()
    turn = await client.run_turn(
        session_id,
        "hello",
        edit_permission="manual",
        mutations_enabled=False,
        approve=lambda _: False,
    )
    await client.aclose()
    assert turn.final_message["id"] == "a1"


async def test_stale_transcript_conflict_is_raised_with_its_code() -> None:
    fake = FakePhoenix([_text_turn("a1", "ok")])
    fake.transcript.append({"id": "elsewhere", "role": "user", "parts": []})
    client = _client(fake)
    with pytest.raises(SessionConflict) as excinfo:
        await client._stream_chat(
            SESSION_ID, {"lastMessageId": "wrong", "message": {"id": "u", "role": "user"}}
        )
    await client.aclose()
    assert excinfo.value.code == "agent_session_messages_stale"


async def test_error_chunks_fail_the_turn() -> None:
    async def _iter() -> Any:
        for chunk in (
            {"type": "start", "messageId": "a1"},
            {"type": "error", "errorText": "provider exploded"},
        ):
            yield parse_chunk(chunk)

    with pytest.raises(StreamError, match="provider exploded"):
        await accumulate_assistant_message(_iter())
