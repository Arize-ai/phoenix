"""Internal validation for ATIF trajectories."""

from __future__ import annotations

import re
from typing import Any, List, Mapping, Set

_VALID_SOURCES = {"user", "agent", "system"}
_AGENT_ONLY_FIELDS = {"model_name", "reasoning_content", "tool_calls", "observation", "metrics"}
_SCHEMA_VERSION_PATTERN = re.compile(r"^ATIF-v\d+\.\d+$")


def _validate_atif_trajectory(trajectory: Mapping[str, Any]) -> None:
    """Validate an ATIF trajectory dict, raising ValueError on any issue.

    Checks:
    - Required root fields: schema_version, session_id, agent, steps
    - schema_version format (ATIF-vX.Y)
    - Agent required fields: name, version, model_name
    - Steps are non-empty with sequential step_ids starting at 1
    - Step source is one of: user, agent, system
    - message is required for user/system steps
    - Agent-only fields only appear on agent steps
    - Tool call observations reference valid tool_call_ids in the same step
    """
    errors: List[str] = []

    # Root required fields
    for field in ("schema_version", "session_id", "agent", "steps"):
        if field not in trajectory:
            errors.append(f"Missing required root field: '{field}'")

    if errors:
        raise ValueError("Invalid ATIF trajectory:\n" + "\n".join(f"  - {e}" for e in errors))

    # Schema version format
    schema_version = trajectory["schema_version"]
    if not isinstance(schema_version, str) or not _SCHEMA_VERSION_PATTERN.match(schema_version):
        errors.append(f"Invalid schema_version '{schema_version}': expected format 'ATIF-vX.Y'")

    # Session ID
    session_id = trajectory["session_id"]
    if not isinstance(session_id, str) or not session_id.strip():
        errors.append("session_id must be a non-empty string")

    # Agent validation
    agent = trajectory["agent"]
    if not isinstance(agent, dict):
        errors.append("'agent' must be a dict")
    else:
        for field in ("name", "version", "model_name"):
            if field not in agent:
                errors.append(f"Missing required agent field: '{field}'")
            elif not isinstance(agent[field], str) or not agent[field].strip():
                errors.append(f"agent.{field} must be a non-empty string")

    # Steps validation
    steps = trajectory["steps"]
    if not isinstance(steps, list) or len(steps) == 0:
        errors.append("'steps' must be a non-empty list")
        raise ValueError("Invalid ATIF trajectory:\n" + "\n".join(f"  - {e}" for e in errors))

    for i, step in enumerate(steps):
        prefix = f"steps[{i}]"
        if not isinstance(step, dict):
            errors.append(f"{prefix}: must be a dict")
            continue

        # Required step fields
        for field in ("step_id", "timestamp", "source"):
            if field not in step:
                errors.append(f"{prefix}: missing required field '{field}'")

        # Sequential step_id check
        step_id = step.get("step_id")
        expected_id = i + 1
        if step_id != expected_id:
            errors.append(
                f"{prefix}: step_id is {step_id}, expected {expected_id} "
                f"(must be sequential from 1)"
            )

        # Source validation
        source = step.get("source")
        if source not in _VALID_SOURCES:
            errors.append(f"{prefix}: source '{source}' must be one of {_VALID_SOURCES}")

        # Message required for user/system steps
        if source in ("user", "system"):
            if "message" not in step or not isinstance(step.get("message"), str):
                errors.append(f"{prefix}: message is required for {source} steps")
            # Agent-only fields should not appear
            for field in _AGENT_ONLY_FIELDS:
                if field in step:
                    errors.append(f"{prefix}: '{field}' is not allowed on {source} steps")

        # Tool call / observation cross-reference
        if source == "agent" and "tool_calls" in step:
            tool_calls = step["tool_calls"]
            if not isinstance(tool_calls, list):
                errors.append(f"{prefix}: tool_calls must be a list")
            else:
                tool_call_ids: Set[str] = set()
                for j, tc in enumerate(tool_calls):
                    tc_prefix = f"{prefix}.tool_calls[{j}]"
                    if not isinstance(tc, dict):
                        errors.append(f"{tc_prefix}: must be a dict")
                        continue
                    for field in ("tool_call_id", "function_name", "arguments"):
                        if field not in tc:
                            errors.append(f"{tc_prefix}: missing required field '{field}'")
                    tc_id = tc.get("tool_call_id")
                    if isinstance(tc_id, str):
                        tool_call_ids.add(tc_id)

                # Validate observations reference valid tool_call_ids
                observation = step.get("observation")
                if observation is not None:
                    if not isinstance(observation, dict) or "results" not in observation:
                        errors.append(f"{prefix}.observation: must be a dict with 'results'")
                    else:
                        for k, result in enumerate(observation["results"]):
                            r_prefix = f"{prefix}.observation.results[{k}]"
                            if not isinstance(result, dict):
                                errors.append(f"{r_prefix}: must be a dict")
                                continue
                            for field in ("source_call_id", "content"):
                                if field not in result:
                                    errors.append(f"{r_prefix}: missing required field '{field}'")
                            source_call_id = result.get("source_call_id")
                            if (
                                isinstance(source_call_id, str)
                                and source_call_id not in tool_call_ids
                            ):
                                errors.append(
                                    f"{r_prefix}: source_call_id '{source_call_id}' does not "
                                    f"match any tool_call_id in this step"
                                )

    if errors:
        raise ValueError("Invalid ATIF trajectory:\n" + "\n".join(f"  - {e}" for e in errors))
