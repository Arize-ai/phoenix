"""Seed a PXI agent session with an example's primed transcript.

``plan_seed`` turns an example into the rows to store and the request the chat client
sends to continue the turn. The command line writes the rows to the Phoenix database
and the plan to a JSON file for the client and the verifier::

    PYTHONPATH=/opt/verifier python -m evals.harbor.pxi.seed /app/example.json \
        --model openai/gpt-5.4 --out /app/seed.json

The transcript ends either with a user message, which the client posts as the turn's
message, or with an assistant message whose tool calls have completed outputs. In the
second case the stored copy holds the calls as pending ``input-available`` parts and the
client submits the outputs as ``toolOutputs``, the same way the browser answers a
client-executed tool. The server then resumes the turn from that point.
"""

from __future__ import annotations

import argparse
import base64
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from evals.harbor.pxi.transcripts import (
    convert_fixture_data_to_datastream_protocol_messages,
)
from phoenix.config import get_env_phoenix_agents_assistant_project_name
from phoenix.db.types.data_stream_protocol.phoenix_types import (
    MessageMetadata,
    PhoenixUIMessage,
    PhoenixUserMessageMetadata,
)
from phoenix.db.types.data_stream_protocol.ui_state_types import UIContexts
from phoenix.server.agents.context import ChatContext, resolve_contexts

_COMPLETED_STATES = ("output-available", "output-error")
_TOOL_PREFIX = "tool-"


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
    client: dict[str, Any] = {
        "edit_permission": edit_permission,
        "contexts": _chat_contexts(
            raw_contexts, mutations_enabled=edit_permission == "bypass", now=now
        ),
        "message": None,
        "tool_outputs": [],
        "last_message_id": None,
    }
    scoring: dict[str, Any] = {
        "client_message_id": None,
        "resumed_message_id": None,
        "seeded_part_count": 0,
    }
    if last.role == "user":
        stored = [_dump(message) for message in renamed[:-1]]
        client["message"] = _dump(last)
        client["last_message_id"] = stored[-1]["id"] if stored else None
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
        client["tool_outputs"] = completed
        client["last_message_id"] = trailing["id"]
        scoring["resumed_message_id"] = trailing["id"]
        scoring["seeded_part_count"] = len(trailing["parts"])
    scoring["seeded_message_ids"] = [message["id"] for message in stored]

    provider, model_name = _model_selection(model)
    return {
        "session": {
            "project_name": get_env_phoenix_agents_assistant_project_name(),
            "title": f"{example['dataset']}/{example['id']}",
            "model_provider": provider,
            "model_name": model_name,
        },
        "stored_messages": stored,
        "client": client,
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
    parser.add_argument("example", type=Path)
    parser.add_argument("--model", required=True, help="Harbor provider/model name")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--database-url", default="sqlite:////data/phoenix.db")
    args = parser.parse_args(argv)
    example = json.loads(args.example.read_text())
    plan = plan_seed(example, model=args.model)
    rowid = write_session(plan, database_url=args.database_url)
    plan["session_id"] = agent_session_global_id(rowid)
    args.out.write_text(json.dumps(plan, indent=2) + "\n")
    print(json.dumps({"session_id": plan["session_id"], "stored": len(plan["stored_messages"])}))


if __name__ == "__main__":
    main()
