"""Efficiency measurements from a Harbor ATIF trajectory."""

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


def measurements(trajectory: dict[str, Any] | None) -> dict[str, float]:
    """Count tool calls and LLM turns across the agent's own steps.

    Copied continuation context is skipped. Returns an empty dict when there
    is no usable trajectory, so a missing file omits the measurements rather
    than reporting zero.
    """
    if not isinstance(trajectory, dict) or not isinstance(trajectory.get("steps"), list):
        return {}
    tool_calls = 0
    turns = 0
    for step in trajectory["steps"]:
        if (
            not isinstance(step, dict)
            or step.get("source") != "agent"
            or step.get("is_copied_context")
        ):
            continue
        calls = step.get("tool_calls")
        if isinstance(calls, list):
            tool_calls += len(calls)
        if step.get("llm_call_count", 1) != 0:
            turns += 1
    return {"tool_call_count": float(tool_calls), "agent_turn_count": float(turns)}
