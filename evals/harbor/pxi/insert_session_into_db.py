"""Seed a PXI agent session with an example's primed transcript.

``plan_seed`` turns an example into the rows to store and the ``ChatRequestBody`` that
continues the turn. The command line reads the example from stdin, writes the rows to the
Phoenix database and the plan (example included) to a JSON file for the verifier, and
prints the request for the chat client::

    PYTHONPATH=/opt/verifier python -m evals.harbor.pxi.insert_session_into_db \
        --model openai/gpt-5.4 --out /app/seed.json < example.json

The transcript ends either with a user message, which becomes the request's ``message``,
or with an assistant message whose tool calls have completed outputs. In the second case
the stored copy holds the calls as pending ``input-available`` parts and the request
submits the outputs as ``toolOutputs``, the same way the browser answers a
client-executed tool. The server then resumes the turn from that point.

The request is non-headless so the browser tools are offered as in the UI, and does not
record local traces, so trajectories carry token counts but no per-call latencies.
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from phoenix.config import get_env_phoenix_agents_assistant_project_name
from phoenix.db.types.data_stream_protocol.phoenix_types import (
    MessageMetadata,
    PhoenixUIMessage,
    PhoenixUserMessageMetadata,
)
from phoenix.db.types.data_stream_protocol.request_types import TextUIPart
from phoenix.db.types.data_stream_protocol.ui_state_types import UIContexts
from phoenix.server.agents.context import ChatContext, resolve_contexts

_COMPLETED_STATES = ("output-available", "output-error")
_TOOL_PREFIX = "tool-"


def convert_fixture_data_to_datastream_protocol_messages(
    raw: Any,
) -> list[PhoenixUIMessage]:
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


def _dump(message: PhoenixUIMessage) -> dict[str, Any]:
    dumped: dict[str, Any] = message.model_dump(mode="json", by_alias=True, exclude_none=True)
    return dumped


def _user_metadata(message: PhoenixUIMessage) -> PhoenixUserMessageMetadata | None:
    metadata = message.metadata
    if metadata is None or not isinstance(metadata.phoenix, PhoenixUserMessageMetadata):
        return None
    return metadata.phoenix


def _raw_contexts(input: dict[str, Any], messages: list[PhoenixUIMessage]) -> list[Any]:
    if "contexts" in input:
        contexts = input["contexts"]
        if not isinstance(contexts, list):
            raise ValueError("PXI eval input.contexts must be a list when provided")
        return list(contexts)
    for message in reversed(messages):
        metadata = _user_metadata(message)
        if metadata is not None and metadata.ui_contexts is not None:
            return list(metadata.ui_contexts.model_dump(exclude_none=True, by_alias=True).values())
    return []


def _edit_permission(input: dict[str, Any], messages: list[PhoenixUIMessage]) -> str:
    permission = input.get("editPermission")
    if permission is None:
        for message in reversed(messages):
            if (metadata := _user_metadata(message)) is not None:
                permission = metadata.edit_permission
                break
    if permission is None:
        permission = "manual"
    if permission not in ("manual", "bypass"):
        raise ValueError("PXI eval input.editPermission must be manual or bypass")
    return str(permission)


def _ui_contexts(raw_contexts: list[Any]) -> UIContexts:
    resolved = resolve_contexts([ChatContext.model_validate(context) for context in raw_contexts])
    return UIContexts(**{name: getattr(resolved, name) for name in UIContexts.model_fields})


def _stamp_user_metadata(
    message: PhoenixUIMessage,
    *,
    ui_contexts: UIContexts,
    edit_permission: str,
    now: datetime,
) -> PhoenixUIMessage:
    """Give the active user turn the metadata the browser would have attached."""
    if _user_metadata(message) is not None:
        return message
    dumped = _dump(message)
    dumped["metadata"] = MessageMetadata(
        phoenix=PhoenixUserMessageMetadata(
            type="user",
            current_date_time=now.isoformat(),
            time_zone="UTC",
            ui_contexts=ui_contexts,
            edit_permission=edit_permission,
        )
    ).model_dump(mode="json", by_alias=True, exclude_none=True)
    return PhoenixUIMessage.model_validate(dumped)


def _pending_copy(part: dict[str, Any]) -> dict[str, Any]:
    """The persisted form of a completed tool part: the call, awaiting its output."""
    pending = {
        "type": part["type"],
        "toolCallId": part["toolCallId"],
        "state": "input-available",
        "input": part.get("input"),
    }
    if part["type"] == "dynamic-tool":
        pending["toolName"] = part["toolName"]
    return pending


def _chat_contexts(raw_contexts: list[Any], *, mutations_enabled: bool, now: datetime) -> list[Any]:
    types = {context.get("type") for context in raw_contexts if isinstance(context, dict)}
    contexts = list(raw_contexts)
    if "app" not in types:
        contexts.append(
            {"type": "app", "currentDateTime": now.isoformat(), "timeZone": "UTC"},
        )
    if "graphql" not in types:
        contexts.append({"type": "graphql", "mutationsEnabled": mutations_enabled})
    if "web_access" not in types:
        contexts.append({"type": "web_access", "enabled": False})
    if "subagents" not in types:
        contexts.append({"type": "subagents", "enabled": False})
    return contexts


def _model_selection(harbor_model_name: str) -> tuple[str, str]:
    provider, separator, model_name = harbor_model_name.partition("/")
    if not separator or not model_name:
        raise ValueError(
            f"Expected a Harbor model name of the form provider/model, got {harbor_model_name!r}"
        )
    return provider.upper(), model_name


def plan_seed(
    example: dict[str, Any], *, model: str, now: datetime | None = None
) -> dict[str, Any]:
    """Split an example into stored rows and the client's continuation request."""
    now = now or datetime.now(timezone.utc)
    input = example["input"]
    messages = convert_fixture_data_to_datastream_protocol_messages(input.get("messages"))
    raw_contexts = _raw_contexts(input, messages)
    edit_permission = _edit_permission(input, messages)
    ui_contexts = _ui_contexts(raw_contexts)

    renamed: list[PhoenixUIMessage] = []
    for message in messages:
        dumped = _dump(message)
        dumped["id"] = str(uuid4())
        renamed.append(PhoenixUIMessage.model_validate(dumped))
    active_user_index = max(
        (index for index, message in enumerate(renamed) if message.role == "user"), default=None
    )
    if active_user_index is None:
        raise ValueError("PXI eval messages must contain a user turn")
    renamed[active_user_index] = _stamp_user_metadata(
        renamed[active_user_index],
        ui_contexts=ui_contexts,
        edit_permission=edit_permission,
        now=now,
    )

    last = renamed[-1]
    provider, model_name = _model_selection(model)
    request: dict[str, Any] = {
        "trigger": "submit-message",
        "headless": False,
        "recordLocalTraces": False,
        "model": {"providerType": "builtin", "provider": provider, "modelName": model_name},
        "editPermission": edit_permission,
        "contexts": _chat_contexts(
            raw_contexts, mutations_enabled=edit_permission == "bypass", now=now
        ),
    }
    scoring: dict[str, Any] = {
        "client_message_id": None,
        "resumed_message_id": None,
        "seeded_part_count": 0,
    }
    if last.role == "user":
        stored = [_dump(message) for message in renamed[:-1]]
        request["message"] = _dump(last)
        if stored:
            request["lastMessageId"] = stored[-1]["id"]
        scoring["client_message_id"] = last.id
    else:
        stored = [_dump(message) for message in renamed]
        trailing = stored[-1]
        completed = [part for part in trailing["parts"] if part.get("state") in _COMPLETED_STATES]
        if not completed:
            raise ValueError("PXI eval messages must end with a user turn or a tool return")
        trailing["parts"] = [
            _pending_copy(part) if part.get("state") in _COMPLETED_STATES else part
            for part in trailing["parts"]
        ]
        PhoenixUIMessage.model_validate(trailing)
        request["toolOutputs"] = completed
        request["lastMessageId"] = trailing["id"]
        scoring["resumed_message_id"] = trailing["id"]
        scoring["seeded_part_count"] = len(trailing["parts"])
    scoring["seeded_message_ids"] = [message["id"] for message in stored]

    return {
        "example": example,
        "session": {
            "project_name": get_env_phoenix_agents_assistant_project_name(),
            "title": f"{example['dataset']}/{example['id']}",
            "model_provider": provider,
            "model_name": model_name,
        },
        "stored_messages": stored,
        "request": request,
        "scoring": scoring,
    }


def agent_session_global_id(rowid: int) -> str:
    return base64.b64encode(f"AgentSession:{rowid}".encode()).decode()


def write_session(plan: dict[str, Any], *, database_url: str) -> int:
    """Insert the session and its stored messages; return the session rowid."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from phoenix.db import models
    from phoenix.db.types.model_provider import ModelProvider

    engine = create_engine(database_url)
    with Session(engine) as session:
        agent_session = models.AgentSession(
            user_id=None,
            title=plan["session"]["title"],
            project_name=plan["session"]["project_name"],
            is_ephemeral=False,
            model_provider=ModelProvider(plan["session"]["model_provider"]),
            model_name=plan["session"]["model_name"],
        )
        session.add(agent_session)
        session.flush()
        session.add_all(
            models.AgentSessionMessage(
                agent_session_id=agent_session.id,
                message=PhoenixUIMessage.model_validate(message),
            )
            for message in plan["stored_messages"]
        )
        session.commit()
        return int(agent_session.id)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, help="Harbor provider/model name")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--database-url", default="sqlite:////data/phoenix.db")
    args = parser.parse_args(argv)
    example = json.load(sys.stdin)
    plan = plan_seed(example, model=args.model)
    rowid = write_session(plan, database_url=args.database_url)
    plan["session_id"] = agent_session_global_id(rowid)
    plan["request"]["id"] = plan["session_id"]
    args.out.write_text(json.dumps(plan, indent=2) + "\n")
    print(json.dumps(plan["request"]))


if __name__ == "__main__":
    main()
