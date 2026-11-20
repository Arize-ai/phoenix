"""Validated Slack request context for Factory workflow starts."""

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional
from uuid import UUID


@dataclass(frozen=True)
class MessageRequest:
    instruction: str
    reply_binding: str
    requesters: list[str]


def read_message_request(
    *, lock_path: Path, read_permission: Callable[..., str]
) -> Optional[MessageRequest]:
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if not event_path or os.environ.get("GITHUB_EVENT_NAME") != "workflow_dispatch":
        return None
    event = json.loads(Path(event_path).read_text())
    encoded = event.get("inputs", {}).get("message_request")
    if not encoded:
        return None
    if not isinstance(encoded, str) or len(encoded) > 65535:
        raise ValueError("Invalid Factory message request")
    request = json.loads(encoded)
    if not isinstance(request, dict):
        raise ValueError("Invalid Factory message request")
    instruction = request.get("instruction")
    binding = request.get("reply_binding")
    requesters = request.get("requesters")
    workspace_id = request.get("workspace_id")
    if not isinstance(instruction, str) or not 1 <= len(instruction) <= 30000:
        raise ValueError("Invalid Factory message instruction")
    if not isinstance(binding, str) or str(UUID(binding)) != binding:
        raise ValueError("Invalid Factory message binding")
    if (
        not isinstance(requesters, list)
        or not requesters
        or any(
            not isinstance(login, str) or not re.fullmatch(r"[A-Za-z0-9-]+", login)
            for login in requesters
        )
    ):
        raise ValueError("Invalid Factory message requesters")
    lock = json.loads(lock_path.read_text())
    if not isinstance(workspace_id, str) or lock["origin"]["workspace_id"] != workspace_id:
        raise ValueError("Factory message workspace does not match worker resources")
    dispatcher_login = event.get("sender", {}).get("login")
    if not isinstance(dispatcher_login, str) or read_permission(login=dispatcher_login) not in {
        "write",
        "admin",
    }:
        raise ValueError("Factory message dispatcher needs repository write access")
    if any(read_permission(login=login) not in {"write", "admin"} for login in requesters):
        raise ValueError("Every Factory message requester needs repository write access")
    return MessageRequest(instruction=instruction, reply_binding=binding, requesters=requesters)
