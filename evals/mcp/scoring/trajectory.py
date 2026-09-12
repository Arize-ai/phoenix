"""Extract final answers and tool counts from Harbor ATIF trajectories."""

import json
import shlex
from pathlib import Path
from typing import Any


def trajectory_measurements(trajectory: dict[str, Any] | None) -> dict[str, int]:
    """Count calls, including failures/retries, once; observations are never calls.

    Copied continuation context is excluded. Missing or malformed records omit
    counts, distinguishing unavailable evidence from a real zero-call answer.
    """
    unavailable = {"tool_measurement_complete": 0}
    if not isinstance(trajectory, dict) or trajectory.get("schema_version") not in {
        f"ATIF-v1.{i}" for i in range(8)
    }:
        return unavailable
    steps = trajectory.get("steps")
    if not isinstance(steps, list) or not steps:
        return unavailable
    calls: set[str] = set()
    turns = 0
    for step in steps:
        if not isinstance(step, dict) or step.get("source") not in {"agent", "system", "user"}:
            return unavailable
        if step.get("is_copied_context") or step["source"] != "agent":
            continue
        turns += int(step.get("llm_call_count") != 0)
        emitted = step.get("tool_calls") or []
        if not isinstance(emitted, list):
            return unavailable
        for call in emitted:
            if not isinstance(call, dict):
                return unavailable
            call_id = call.get("tool_call_id")
            if not isinstance(call_id, str) or not call_id or call_id in calls:
                return unavailable
            calls.add(call_id)
    return {
        "tool_measurement_complete": 1,
        "tool_call_count": len(calls),
        "agent_turn_count": turns,
    }


def final_answer(trajectory: dict[str, Any] | None) -> str | None:
    """Use only the terminal agent response, never an intermediate tool-step guess."""
    if not isinstance(trajectory, dict) or not isinstance(trajectory.get("steps"), list):
        return None
    if not all(isinstance(s, dict) for s in trajectory["steps"]):
        return None
    steps = [s for s in trajectory["steps"] if not s.get("is_copied_context")]
    if not steps or steps[-1].get("source") != "agent" or steps[-1].get("tool_calls"):
        return None
    message = steps[-1].get("message")
    if isinstance(message, str):
        return message
    if isinstance(message, list) and all(
        isinstance(p, dict) and p.get("type") == "text" and isinstance(p.get("text"), str)
        for p in message
    ):
        return "\n".join(p["text"] for p in message)
    return None


def read_trajectory(path: Path) -> dict[str, Any] | None:
    """Load a saved ATIF object, returning None when unavailable or malformed."""
    try:
        value = json.loads(path.read_text())
    except (OSError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def px_command_observed(trajectory: dict[str, Any] | None) -> bool | None:
    """Identify recorded px tool calls or shell commands with a px executable.

    This inspects submitted commands. It does not prove which executable ran;
    target request logs provide separate evidence of Phoenix access.
    """
    if not trajectory_measurements(trajectory)["tool_measurement_complete"]:
        return None
    assert trajectory is not None
    for step in trajectory["steps"]:
        if step.get("source") != "agent" or step.get("is_copied_context"):
            continue
        for call in step.get("tool_calls") or []:
            if call.get("function_name") == "px":
                return True
            arguments = call.get("arguments")
            if not isinstance(arguments, dict):
                continue
            command = arguments.get("command", arguments.get("cmd"))
            if isinstance(command, list):
                if not all(isinstance(x, str) for x in command):
                    continue
                if (
                    len(command) >= 3
                    and Path(command[0]).name in {"bash", "sh", "zsh"}
                    and command[1].startswith("-")
                    and "c" in command[1]
                ):
                    command = command[2]
                else:
                    command = shlex.join(command)
            if not isinstance(command, str):
                continue
            try:
                lexer = shlex.shlex(command, posix=True, punctuation_chars=True)
                lexer.whitespace = " \t\r"
                words = list(lexer)
            except ValueError:
                continue
            at_start = True
            for word in words:
                if word in {";", "&&", "||", "|", "(", "\n"}:
                    at_start = True
                elif at_start and "=" in word and not word.startswith("/"):
                    continue
                else:
                    if at_start and word in {"px", "/usr/local/bin/px"}:
                        return True
                    at_start = False
    return False
