"""Fixture authoring helpers at Phoenix's public session-transcript boundary."""

from __future__ import annotations

import json
from typing import Any

from phoenix.db.types.data_stream_protocol.phoenix_types import PhoenixUIMessage
from phoenix.db.types.data_stream_protocol.request_types import TextUIPart


def fixture_messages(raw: Any) -> list[PhoenixUIMessage]:
    """Accept public UI messages or compile the existing compact YAML notation.

    Tool results belong to assistant message parts in a stored Phoenix session.
    The shorthand's separate tool rows only pair outputs with their calls; they
    are not a second transcript format passed directly to the model provider.
    """
    if not isinstance(raw, list) or not raw:
        raise ValueError("PXI eval input.messages must be a non-empty list")
    if not all(isinstance(message, dict) for message in raw):
        raise ValueError("PXI eval input.messages entries must be objects")
    if any("parts" in message for message in raw):
        messages = [PhoenixUIMessage.model_validate(message) for message in raw]
    else:
        messages = _from_shorthand(raw)
    last = messages[-1]
    if last.role == "user":
        if not any(isinstance(part, TextUIPart) and part.text.strip() for part in last.parts):
            raise ValueError("PXI eval final user message must contain non-empty text")
    elif last.role == "assistant":
        if not any(
            getattr(part, "state", None) in ("output-available", "output-error")
            for part in last.parts
        ):
            raise ValueError("PXI eval messages must end with a user turn or a tool return")
    else:
        raise ValueError("PXI eval messages must end with a user turn or a tool return")
    # A primed prefix must be resumable. Pending calls/approvals need a browser
    # callback and are not completed evidence from which this offline run starts.
    seen: set[str] = set()
    for message in messages:
        for part in message.parts:
            call_id = getattr(part, "tool_call_id", None)
            if call_id is None:
                continue
            if call_id in seen:
                raise ValueError(f"Duplicate tool call id: {call_id}")
            seen.add(call_id)
            if getattr(part, "state", None) not in ("output-available", "output-error"):
                raise ValueError(f"Tool call {call_id} has no completed output")
    return messages


def _from_shorthand(raw: list[dict[str, Any]]) -> list[PhoenixUIMessage]:
    messages: list[dict[str, Any]] = []
    pending: dict[str, dict[str, Any]] = {}
    seen: set[str] = set()
    for index, item in enumerate(raw):
        role = item.get("role")
        if role == "tool":
            call_id = item.get("tool_call_id")
            if not isinstance(call_id, str):
                raise ValueError("Tool returns require a string tool_call_id")
            part = pending.pop(call_id, None)
            if part is None:
                raise ValueError(f"Unknown tool_call_id: {call_id}")
            if part["type"] != f"tool-{item.get('name')}":
                raise ValueError(f"Tool return name does not match call {call_id}")
            if "content" not in item:
                raise ValueError(f"Tool return {call_id} must have content")
            part.update(state="output-available", output=item["content"])
            continue
        if pending:
            raise ValueError("Complete pending tool outputs before the next message")
        if role not in ("user", "assistant"):
            raise ValueError("Fixture role must be user, assistant, or tool")
        parts: list[dict[str, Any]] = []
        if "content" in item:
            if not isinstance(item["content"], str):
                raise ValueError("User and assistant content must be a string")
            parts.append({"type": "text", "text": item["content"]})
        calls = item.get("tool_calls", [])
        if not isinstance(calls, list) or (calls and role != "assistant"):
            raise ValueError("Only assistant messages may contain a list of tool calls")
        for call in calls:
            if not isinstance(call, dict):
                raise ValueError("Tool calls must be objects")
            call_id, name = call.get("id"), call.get("name")
            if not isinstance(call_id, str) or not call_id or not isinstance(name, str) or not name:
                raise ValueError("Tool calls require non-empty id and name")
            if call_id in seen:
                raise ValueError(f"Duplicate tool call id: {call_id}")
            seen.add(call_id)
            args = call.get("args", {})
            if isinstance(args, str):
                args = json.loads(args)
            if not isinstance(args, dict):
                raise ValueError("Tool call args must be an object")
            part = {
                "type": f"tool-{name}",
                "toolCallId": call_id,
                "state": "input-available",
                "input": args,
            }
            pending[call_id] = part
            parts.append(part)
        if not parts:
            raise ValueError("User and assistant messages require text or tool calls")
        messages.append({"id": f"fixture-{index}", "role": role, "parts": parts})
    if pending:
        raise ValueError(f"Primed calls without matching tool returns: {sorted(pending)}")
    return [PhoenixUIMessage.model_validate(message) for message in messages]
