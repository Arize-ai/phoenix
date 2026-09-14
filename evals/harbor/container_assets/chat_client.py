#!/usr/bin/env python3
"""Run one PXI turn through the agent session chat route of the local Phoenix server.

Mirrors what the ``pxi`` CLI does in ``js/packages/phoenix-cli/src/pxi/client.ts``:
create a session, submit a user message with ``headless: true``, read the SSE
data stream into an assistant message, and answer tool approvals until the turn
settles. Runs inside the task container, where the Phoenix wheel is installed,
so the stream is reduced by the server's own port of the AI SDK reducer.
"""

import argparse
import asyncio
import json
import re
from collections.abc import AsyncIterator, Callable, Iterable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

import httpx
from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, DataChunk

from phoenix.server.agents.ui_message_stream import iter_chunks_with_error_parts
from phoenix.server.agents.vercel_ui_message_stream import read_ui_message_stream

EditPermission = Literal["manual", "bypass"]
Message = dict[str, Any]
Part = dict[str, Any]
ApprovalPolicy = Callable[[Part], bool]
"""Decides whether a tool part in ``approval-requested`` state is approved."""

_SSE_DATA_PREFIX = "data: "
_SSE_DONE = "data: [DONE]"
_BUSY_RETRY_DELAY_SECONDS = 2.0
_BUSY_RETRY_ATTEMPTS = 30

_CHUNK_TYPES: dict[str, type[BaseChunk]] = {
    default: chunk_type
    for chunk_type in BaseChunk.__subclasses__()
    if isinstance(default := chunk_type.model_fields["type"].default, str)
}


def parse_chunk(payload: dict[str, Any]) -> BaseChunk | None:
    """``None`` for chunk types the reducer has no model for."""
    chunk_type = payload["type"]
    if chunk_type.startswith("data-"):
        return DataChunk.model_validate(payload)
    model = _CHUNK_TYPES.get(chunk_type)
    return model.model_validate(payload) if model is not None else None


async def iter_sse_chunks(lines: AsyncIterator[str]) -> AsyncIterator[BaseChunk]:
    async for line in lines:
        line = line.rstrip("\r")
        if line == _SSE_DONE or not line.startswith(_SSE_DATA_PREFIX):
            continue
        chunk = parse_chunk(json.loads(line[len(_SSE_DATA_PREFIX) :]))
        if chunk is not None:
            yield chunk


class StreamError(Exception):
    """The server emitted an ``error`` chunk during the turn."""


async def accumulate_assistant_message(chunks: AsyncIterator[BaseChunk]) -> Message:
    errors: list[str] = []
    latest: Any = None
    async for message in read_ui_message_stream(
        stream=iter_chunks_with_error_parts(chunks), on_error=lambda e: errors.append(str(e))
    ):
        latest = message
    if errors:
        raise StreamError("; ".join(errors))
    if latest is None:
        raise RuntimeError("The chat stream ended without producing an assistant message")
    dumped: Message = latest.model_dump(mode="json", by_alias=True, exclude_none=True)
    return dumped


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


def _load_step_config(path: Path | None) -> dict[str, Any]:
    if path is None or not path.is_file():
        return {}
    config = json.loads(path.read_text())
    return config if isinstance(config, dict) else {}


def _dump_json(value: Any) -> str:
    return json.dumps(value, indent=2) + "\n"


async def run(args: argparse.Namespace) -> None:
    step_config = _load_step_config(args.step_config)
    allow_mutations = bool(step_config.get("allow_mutations", False))
    approve_tool_calls = bool(step_config.get("approve_tool_calls", False))
    edit_permission: EditPermission = "bypass" if allow_mutations else "manual"
    client = AgentSessionChatClient(
        args.base_url,
        model=builtin_model_selection(args.model),
        turn_timeout_seconds=float(step_config.get("turn_timeout_seconds", 900.0)),
    )
    try:
        session_id = args.session_id or await client.create_session()
        turn = await client.run_turn(
            session_id,
            args.instruction_file.read_text(),
            edit_permission=edit_permission,
            mutations_enabled=allow_mutations,
            approve=lambda _part: approve_tool_calls,
            export_remote_traces=args.export_remote_traces,
        )
        transcript = await client.list_messages(session_id)
    finally:
        await client.aclose()

    answer = answer_text(turn.final_message)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    args.out_dir.joinpath("session_id").write_text(session_id + "\n")
    args.out_dir.joinpath("answer.md").write_text(answer)
    args.out_dir.joinpath("answer.json").write_text(_dump_json(parse_json_answer(answer)))
    args.out_dir.joinpath("new_messages.json").write_text(_dump_json(turn.assistant_messages))
    args.out_dir.joinpath("messages.json").write_text(_dump_json(transcript))
    args.out_dir.joinpath("metrics.json").write_text(
        _dump_json({"tool_calls": count_tool_calls(turn.assistant_messages)})
    )
    args.out_dir.joinpath("usage.json").write_text(_dump_json(turn.usage))
    if args.latest_symlink is not None:
        args.latest_symlink.parent.mkdir(parents=True, exist_ok=True)
        args.latest_symlink.unlink(missing_ok=True)
        args.latest_symlink.symlink_to(args.out_dir)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:6006")
    parser.add_argument("--model", required=True, help="Harbor provider/model name")
    parser.add_argument("--instruction-file", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument(
        "--session-id", default=None, help="Continue this session; omit to create one"
    )
    parser.add_argument("--step-config", type=Path, default=None)
    parser.add_argument("--latest-symlink", type=Path, default=None)
    parser.add_argument("--export-remote-traces", action="store_true")
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
