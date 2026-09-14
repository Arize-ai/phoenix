"""Client for Phoenix's agent session chat route and its UI message stream.

Mirrors what the ``pxi`` CLI does in ``js/packages/phoenix-cli/src/pxi/client.ts``:
create a session, submit a user message with ``headless: true``, read the SSE
data stream into an assistant message, and answer tool approvals until the turn
settles.

This runs inside Harbor's Python environment, which cannot install the Phoenix
wheel alongside Harbor (their ``openai`` pins conflict), so it depends only on
httpx and reduces the stream itself. The reducer covers the chunk types the eval
reads back: text, tool parts, approvals, message metadata, and errors.
"""

import asyncio
import json
import re
from collections.abc import AsyncIterator, Callable, Iterable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal, TypedDict
from uuid import uuid4

import httpx

EditPermission = Literal["manual", "bypass"]
Part = dict[str, Any]


class Message(TypedDict, total=False):
    id: str
    role: Literal["system", "user", "assistant"]
    parts: list[Part]
    metadata: dict[str, Any]


ApprovalPolicy = Callable[[Part], bool]
"""Decides whether a tool part in ``approval-requested`` state is approved."""

_SSE_DATA_PREFIX = "data: "
_SSE_DONE = "data: [DONE]"
_BUSY_RETRY_DELAY_SECONDS = 2.0
_BUSY_RETRY_ATTEMPTS = 30


async def iter_sse_chunks(lines: AsyncIterator[str]) -> AsyncIterator[dict[str, Any]]:
    async for line in lines:
        line = line.rstrip("\r")
        if line == _SSE_DONE or not line.startswith(_SSE_DATA_PREFIX):
            continue
        yield json.loads(line[len(_SSE_DATA_PREFIX) :])


class StreamError(Exception):
    """The server emitted an ``error`` chunk during the turn."""


class MessageReducer:
    def __init__(self) -> None:
        self.message: Message = {"role": "assistant", "parts": []}
        self.errors: list[str] = []
        self._text_parts: dict[str, Part] = {}
        self._tool_parts: dict[str, Part] = {}

    def feed(self, chunk: dict[str, Any]) -> None:
        chunk_type = chunk["type"]
        if chunk_type == "start":
            if message_id := chunk.get("messageId"):
                self.message["id"] = message_id
            self._merge_metadata(chunk.get("messageMetadata"))
        elif chunk_type == "text-start":
            part = {"type": "text", "text": "", "state": "streaming"}
            self._text_parts[chunk["id"]] = part
            self.message["parts"].append(part)
        elif chunk_type == "text-delta":
            self._text_parts[chunk["id"]]["text"] += chunk["delta"]
        elif chunk_type == "text-end":
            self._text_parts[chunk["id"]]["state"] = "done"
        elif chunk_type == "tool-input-start":
            self._tool_part(chunk)["state"] = "input-streaming"
        elif chunk_type == "tool-input-available":
            self._tool_part(chunk).update(state="input-available", input=chunk.get("input"))
        elif chunk_type == "tool-input-error":
            self._tool_part(chunk).update(
                state="output-error", input=chunk.get("input"), errorText=chunk["errorText"]
            )
        elif chunk_type == "tool-output-available":
            self._tool_part(chunk).update(state="output-available", output=chunk.get("output"))
        elif chunk_type == "tool-output-error":
            self._tool_part(chunk).update(state="output-error", errorText=chunk["errorText"])
        elif chunk_type == "tool-approval-request":
            self._tool_part(chunk).update(
                state="approval-requested", approval={"id": chunk["approvalId"]}
            )
        elif chunk_type == "tool-output-denied":
            self._tool_part(chunk)["state"] = "output-denied"
        elif chunk_type in ("message-metadata", "finish"):
            self._merge_metadata(chunk.get("messageMetadata"))
        elif chunk_type == "error":
            self.errors.append(str(chunk.get("errorText", "")))

    def _tool_part(self, chunk: dict[str, Any]) -> Part:
        tool_call_id = chunk["toolCallId"]
        if (part := self._tool_parts.get(tool_call_id)) is None:
            part = {"type": "dynamic-tool", "toolCallId": tool_call_id}
            self._tool_parts[tool_call_id] = part
            self.message["parts"].append(part)
        if tool_name := chunk.get("toolName"):
            part["toolName"] = tool_name
        return part

    def _merge_metadata(self, metadata: Any) -> None:
        if isinstance(metadata, dict):
            self.message["metadata"] = _merge_objects(self.message.get("metadata"), metadata)


def _merge_objects(base: Any, overrides: Any) -> Any:
    if not isinstance(base, dict) or not isinstance(overrides, dict):
        return overrides
    merged = dict(base)
    for key, value in overrides.items():
        merged[key] = _merge_objects(base.get(key), value)
    return merged


async def accumulate_assistant_message(chunks: AsyncIterator[dict[str, Any]]) -> Message:
    reducer = MessageReducer()
    async for chunk in chunks:
        reducer.feed(chunk)
    if reducer.errors:
        raise StreamError("; ".join(reducer.errors))
    if "id" not in reducer.message:
        raise RuntimeError("The chat stream ended without a start chunk naming the message")
    return reducer.message


def builtin_model_selection(harbor_model_name: str) -> dict[str, Any]:
    """The server, not this client, rejects providers Phoenix does not know."""
    provider, separator, model_name = harbor_model_name.partition("/")
    if not separator or not model_name:
        raise ValueError(
            f"Expected a Harbor model name of the form provider/model, got {harbor_model_name!r}"
        )
    return {"provider_type": "builtin", "provider": provider.upper(), "model_name": model_name}


def user_message(text: str) -> Message:
    return {"id": str(uuid4()), "role": "user", "parts": [{"type": "text", "text": text}]}


def chat_contexts(*, mutations_enabled: bool, now: datetime | None = None) -> list[dict[str, Any]]:
    now = now or datetime.now(timezone.utc)
    return [
        {"type": "app", "currentDateTime": now.isoformat(), "timeZone": "UTC"},
        {"type": "graphql", "mutationsEnabled": mutations_enabled},
        {"type": "web_access", "enabled": False},
        {"type": "subagents", "enabled": False},
    ]


def _is_tool_part(part: Part) -> bool:
    part_type = str(part.get("type", ""))
    return part_type == "dynamic-tool" or part_type.startswith("tool-")


def pending_approvals(message: Message) -> list[Part]:
    return [
        part
        for part in message["parts"]
        if _is_tool_part(part) and part.get("state") == "approval-requested"
    ]


def count_tool_calls(messages: Iterable[Message]) -> int:
    return sum(1 for message in messages for part in message["parts"] if _is_tool_part(part))


def answer_text(message: Message) -> str:
    return "".join(part["text"] for part in message["parts"] if part.get("type") == "text")


def parse_json_answer(text: str) -> dict[str, Any]:
    """The last fenced ```json block in the reply, or ``{}`` when there is none."""
    blocks = re.findall(r"```json\s*(.*?)```", text, flags=re.DOTALL | re.IGNORECASE)
    parsed = json.loads(blocks[-1]) if blocks else {}
    return parsed if isinstance(parsed, dict) else {}


class SessionConflict(Exception):
    def __init__(self, code: str, detail: str) -> None:
        super().__init__(detail)
        self.code = code


@dataclass
class Turn:
    """Everything one user instruction produced, across approval continuations."""

    assistant_messages: list[Message] = field(default_factory=list)

    @property
    def final_message(self) -> Message:
        return self.assistant_messages[-1]

    @property
    def usage(self) -> dict[str, Any] | None:
        metadata = self.final_message.get("metadata") or {}
        usage = (metadata.get("phoenix") or {}).get("usage")
        return usage if isinstance(usage, dict) else None


class AgentSessionChatClient:
    def __init__(
        self,
        base_url: str,
        *,
        model: dict[str, Any],
        transport: httpx.AsyncBaseTransport | None = None,
        turn_timeout_seconds: float = 900.0,
    ) -> None:
        self._http = httpx.AsyncClient(
            base_url=base_url,
            transport=transport,
            timeout=httpx.Timeout(turn_timeout_seconds, connect=30.0),
        )
        self._model = model

    async def aclose(self) -> None:
        await self._http.aclose()

    async def create_session(self) -> str:
        response = await self._http.post(
            "/v1/agent_sessions", json={"model": self._model, "is_ephemeral": False}
        )
        _raise_for_status(response)
        return str(response.json()["data"]["id"])

    async def list_messages(self, session_id: str) -> list[Message]:
        messages: list[Message] = []
        cursor: str | None = None
        while True:
            params: dict[str, str | int] = {"limit": 1000}
            if cursor:
                params["cursor"] = cursor
            response = await self._http.get(
                f"/v1/agent_sessions/{session_id}/messages", params=params
            )
            _raise_for_status(response)
            payload = response.json()
            messages.extend(payload["data"])
            cursor = payload.get("next_cursor")
            if not cursor:
                return messages

    async def run_turn(
        self,
        session_id: str,
        instruction: str,
        *,
        edit_permission: EditPermission,
        mutations_enabled: bool,
        approve: ApprovalPolicy,
        record_local_traces: bool = False,
        export_remote_traces: bool = False,
    ) -> Turn:
        """Submit ``instruction`` and answer approvals until the assistant turn settles."""
        transcript = await self.list_messages(session_id)
        last_message_id = transcript[-1]["id"] if transcript else None
        base_body = {
            "id": session_id,
            "trigger": "submit-message",
            "headless": True,
            "model": self._model,
            "editPermission": edit_permission,
            "contexts": chat_contexts(mutations_enabled=mutations_enabled),
            "recordLocalTraces": record_local_traces,
            "exportRemoteTraces": export_remote_traces,
        }
        turn = Turn()
        message = await self._chat(
            session_id,
            {**base_body, "message": user_message(instruction), "lastMessageId": last_message_id},
        )
        turn.assistant_messages.append(message)
        while approvals := pending_approvals(message):
            message = await self._chat(
                session_id,
                {
                    **base_body,
                    "toolApprovals": [
                        {"toolCallId": part["toolCallId"], "approved": approve(part)}
                        for part in approvals
                    ],
                    "lastMessageId": message["id"],
                },
            )
            turn.assistant_messages.append(message)
        return turn

    async def _chat(self, session_id: str, body: dict[str, Any]) -> Message:
        for attempt in range(_BUSY_RETRY_ATTEMPTS):
            try:
                return await self._stream_chat(session_id, body)
            except SessionConflict as conflict:
                if conflict.code != "agent_session_busy" or attempt == _BUSY_RETRY_ATTEMPTS - 1:
                    raise
                await asyncio.sleep(_BUSY_RETRY_DELAY_SECONDS)
        raise AssertionError("unreachable")

    async def _stream_chat(self, session_id: str, body: dict[str, Any]) -> Message:
        async with self._http.stream(
            "POST",
            f"/v1/agent_sessions/{session_id}/chat",
            json=body,
            headers={"accept": "text/event-stream"},
        ) as response:
            if response.status_code >= 400:
                await response.aread()
                _raise_for_status(response)
            return await accumulate_assistant_message(iter_sse_chunks(response.aiter_lines()))


def _raise_for_status(response: httpx.Response) -> None:
    if response.status_code < 400:
        return
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    detail = (
        (payload.get("detail") or payload.get("message")) if isinstance(payload, dict) else None
    )
    message = f"HTTP {response.status_code} from {response.request.url}: {detail or response.text}"
    if response.status_code == 409 and isinstance(payload, dict) and "code" in payload:
        raise SessionConflict(str(payload["code"]), message)
    raise RuntimeError(message)
