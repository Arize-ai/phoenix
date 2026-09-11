"""Measurements of evaluated-agent calls and native SQL dispatch."""

from typing import Any


def sql_measurements(events: list[dict[str, Any]] | None) -> dict[str, int | None]:
    """Count correlated native calls, never infer successful SQL from submitted code."""
    unavailable = {
        "sql_attempted": None,
        "sql_succeeded": None,
        "schema_inspected": None,
        "sql_measurement_complete": 0,
    }
    if events is None or any(event.get("kind") == "sql" for event in events):
        return unavailable
    operations = [
        event for event in events if event.get("operation") in {"executeSql", "describeSqlSchema"}
    ]
    starts = [event for event in operations if event.get("phase") == "started"]
    ends = [event for event in operations if event.get("phase") == "completed"]
    start_ids = [event.get("call_id") for event in starts]
    end_ids = [event.get("call_id") for event in ends]
    if (
        len(starts) + len(ends) != len(operations)
        or any(not isinstance(value, str) or not value for value in start_ids + end_ids)
        or len(set(start_ids)) != len(start_ids)
        or len(set(end_ids)) != len(end_ids)
        or set(start_ids) != set(end_ids)
    ):
        return unavailable
    by_id = {event["call_id"]: event for event in starts}
    if any(
        event["operation"] != by_id[event["call_id"]]["operation"]
        or event.get("outcome") not in {"success", "error"}
        or type(event.get("error_envelope")) is not bool
        for event in ends
    ):
        return unavailable
    successful = [
        event
        for event in ends
        if event["outcome"] == "success" and event["error_envelope"] is False
    ]
    return {
        "sql_attempted": sum(event["operation"] == "executeSql" for event in starts),
        "sql_succeeded": sum(
            event["operation"] == "executeSql" and not event.get("validate_only", False)
            for event in successful
        ),
        "schema_inspected": int(
            any(event["operation"] == "describeSqlSchema" for event in successful)
        ),
        "sql_measurement_complete": 1,
    }


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
