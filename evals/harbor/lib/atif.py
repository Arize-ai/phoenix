"""Read the agent's reply and efficiency measurements from a Harbor ATIF trajectory."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def read_trajectory(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text())
    except (OSError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def agent_steps(trajectory: dict[str, Any] | None) -> list[dict[str, Any]]:
    """The agent's own steps, without copied continuation context."""
    if not isinstance(trajectory, dict) or not isinstance(trajectory.get("steps"), list):
        return []
    return [
        step
        for step in trajectory["steps"]
        if isinstance(step, dict)
        and step.get("source") == "agent"
        and not step.get("is_copied_context")
    ]


def read_reply(trajectory: dict[str, Any] | None) -> str:
    """The text of the last agent step that said anything.

    Every agent hands its answer to the verifier this way: Harbor writes the
    trajectory for the coding agents, and the PXI agent builds one from its
    transcript. A message is either a string or a list of typed parts.
    """
    for step in reversed(agent_steps(trajectory)):
        message = step.get("message")
        if isinstance(message, str) and message.strip():
            return message
        if isinstance(message, list):
            text = "".join(
                str(part.get("text", ""))
                for part in message
                if isinstance(part, dict) and part.get("type") == "text"
            )
            if text.strip():
                return text
    return ""


def measurements(trajectory: dict[str, Any] | None) -> dict[str, float]:
    """Count tool calls and LLM turns across the agent's own steps.

    Returns an empty dict when there is no usable trajectory, so a missing
    file omits the measurements rather than reporting zero.
    """
    if not isinstance(trajectory, dict) or not isinstance(trajectory.get("steps"), list):
        return {}
    tool_calls = 0
    turns = 0
    for step in agent_steps(trajectory):
        calls = step.get("tool_calls")
        if isinstance(calls, list):
            tool_calls += len(calls)
        if step.get("llm_call_count", 1) != 0:
            turns += 1
    return {"tool_call_count": float(tool_calls), "agent_turn_count": float(turns)}
