"""Measure interface and SQL use without changing task correctness."""

from typing import Any

from evals.mcp.scoring.trajectory import px_command_observed


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


def interface_measurements(
    interface: str,
    trajectory: dict[str, Any] | None,
    operations: list[dict[str, Any]] | None,
) -> dict[str, int | None]:
    """Record interface use separately from reward.

    MCP use comes from native dispatch logs. CLI interface_used reports whether
    ATIF contains a submitted px command. It does not prove command execution
    or that every Phoenix request used px. Missing evidence remains unknown.
    """
    if interface == "mcp":
        used = (
            None
            if operations is None
            else int(any(event.get("phase") == "started" for event in operations))
        )
        return {
            "interface_used": used,
            "interface_measurement_complete": int(used is not None),
            "code_mode_used": None
            if operations is None
            else int(
                any(
                    event.get("operation") == "execute" and event.get("phase") == "started"
                    for event in operations
                )
            ),
        }
    if interface != "cli":
        raise ValueError("Unknown benchmark interface")
    observed = px_command_observed(trajectory)
    used = None if observed is None else int(observed)
    return {
        "interface_used": used,
        "interface_measurement_complete": int(used is not None),
        "px_command_observed": used,
    }
