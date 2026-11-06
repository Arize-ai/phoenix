"""Classify whether a reconstructed user-role message is human-authored.

PXI sessions can carry non-human user-role messages: legacy frontend UI
context blocks (``<phoenix_ui_context>``, from the pre-July-2026 trace
format — current traces deliver UI context via agent instructions, never as
a user message), agent-loop continuations (JSON with ``parts``), tool-error
payloads, and agent message payloads.
"""

from __future__ import annotations

import json


def is_human_message(message: str) -> bool:
    text = message.strip()
    if not text:
        return False
    if "<phoenix_ui_context>" in text:
        return False  # legacy frontend UI context block
    try:
        payload = json.loads(text)
    except (json.JSONDecodeError, TypeError, ValueError):
        return True
    if isinstance(payload, dict):
        if "parts" in payload:
            return False  # agent-loop continuation
        if payload.get("data") is None and isinstance(payload.get("errors"), list):
            return False  # tool-error payload
        nested_message = payload.get("message")
        if isinstance(nested_message, dict) and nested_message.get("role") != "user":
            return False  # agent message payload
    return True


__all__ = ["is_human_message"]
