"""Classify whether a reconstructed user-role message is human-authored.

PXI sessions inject non-human user-role messages (frontend UI context,
agent-loop continuations, tool-error payloads). This classification is the
same one used when building the user-friction gold labels, so production
skips exactly what labeling skipped.
"""

from __future__ import annotations

import json
from dataclasses import dataclass


@dataclass(frozen=True)
class MessageOrigin:
    is_human: bool
    kind: str


def classify_user_message(message: str) -> MessageOrigin:
    text = message.strip()
    if not text:
        return MessageOrigin(False, "empty")
    if "<phoenix_ui_context>" in text:
        return MessageOrigin(False, "frontend_ui_context")
    try:
        payload = json.loads(text)
    except (json.JSONDecodeError, TypeError, ValueError):
        return MessageOrigin(True, "human")
    if isinstance(payload, dict):
        if "parts" in payload:
            return MessageOrigin(False, "agent_continuation")
        if payload.get("data") is None and isinstance(payload.get("errors"), list):
            return MessageOrigin(False, "tool_error_payload")
        nested_message = payload.get("message")
        if isinstance(nested_message, dict) and nested_message.get("role") != "user":
            return MessageOrigin(False, "agent_message_payload")
    return MessageOrigin(True, "human")


__all__ = ["MessageOrigin", "classify_user_message"]
