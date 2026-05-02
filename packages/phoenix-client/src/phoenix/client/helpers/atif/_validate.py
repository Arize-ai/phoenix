# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Internal validation for ATIF trajectories."""

from __future__ import annotations

import logging
import re
from typing import Any, List, Mapping, Set

logger = logging.getLogger(__name__)

_MAX_SUPPORTED_MINOR = 6

_VALID_SOURCES = {"user", "agent", "system"}
# Fields that may ONLY appear on agent steps.
# Note: tool_calls, metrics, and observation are allowed on any source since v1.2.
_AGENT_ONLY_FIELDS = {
    "model_name",
    "reasoning_content",
    "reasoning_effort",
}
_SCHEMA_VERSION_PATTERN = re.compile(r"^ATIF-v\d+\.\d+$")


def _validate_atif_trajectory(trajectory: Mapping[str, Any]) -> None:
    """Validate an ATIF trajectory dict, raising ValueError on any issue.

    Checks:
    - Required root fields: schema_version, session_id, agent, steps
    - schema_version format (ATIF-vX.Y); hard reject on major >= 2,
      warning on minor > 6 (latest supported)
    - Agent required fields: name, version (model_name is optional)
    - Steps are non-empty with sequential step_ids starting at 1
    - Step source is one of: user, agent, system
    - message is required for user/system steps
    - Agent-only fields (model_name, reasoning_content, reasoning_effort)
      only on agent steps
    - Tool call structure validation
    - Observation validation (independent of tool_calls); source_call_id
      cross-referenced against tool_call_ids when both are present
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
    else:
        # Parse and check version numbers
        version_part = schema_version.split("-v")[1]
        major_str, minor_str = version_part.split(".")
        major, minor = int(major_str), int(minor_str)
        if major >= 2:
            errors.append(
                f"Unsupported ATIF major version {major} in '{schema_version}': "
                f"only ATIF v1.x is supported"
            )
        elif minor > _MAX_SUPPORTED_MINOR:
            logger.warning(
                "ATIF minor version %d in '%s' is newer than the latest supported "
                "version (v1.%d); some fields may not be validated or converted",
                minor,
                schema_version,
                _MAX_SUPPORTED_MINOR,
            )

    # Session ID
    session_id = trajectory["session_id"]
    if not isinstance(session_id, str) or not session_id.strip():
        errors.append("session_id must be a non-empty string")

    # Agent validation
    agent = trajectory["agent"]
    if not isinstance(agent, dict):
        errors.append("'agent' must be a dict")
    else:
        for field in ("name", "version"):
            if field not in agent:
                errors.append(f"Missing required agent field: '{field}'")
            elif not isinstance(agent[field], str) or not str(agent[field]).strip():
                errors.append(f"agent.{field} must be a non-empty string")
        # model_name is optional but if present must be a string
        if "model_name" in agent and not isinstance(agent["model_name"], str):
            errors.append("agent.model_name must be a string if provided")

    # Steps validation
    raw_steps: object = trajectory["steps"]
    if not isinstance(raw_steps, list) or len(raw_steps) == 0:
        errors.append("'steps' must be a non-empty list")
        raise ValueError("Invalid ATIF trajectory:\n" + "\n".join(f"  - {e}" for e in errors))

    steps: List[Any] = raw_steps
    for i, step in enumerate(steps):
        prefix = f"steps[{i}]"
        if not isinstance(step, dict):
            errors.append(f"{prefix}: must be a dict")
            continue

        step_dict: dict[str, Any] = step

        # Required step fields: step_id and source.
        # timestamp is optional per the ATIF spec.
        for field in ("step_id", "source"):
            if field not in step_dict:
                errors.append(f"{prefix}: missing required field '{field}'")

        # Sequential step_id check
        step_id: object = step_dict.get("step_id")
        expected_id = i + 1
        if step_id != expected_id:
            errors.append(
                f"{prefix}: step_id is {step_id}, "
                f"expected {expected_id} (must be sequential from 1)"
            )

        # Source validation
        source: object = step_dict.get("source")
        if source not in _VALID_SOURCES:
            errors.append(f"{prefix}: source '{source}' must be one of {_VALID_SOURCES}")

        # Message required for user/system steps
        if source in ("user", "system"):
            msg: object = step_dict.get("message")
            if msg is None:
                errors.append(f"{prefix}: message is required for {source} steps")
            # Agent-only fields should not appear on user/system steps
            for field in _AGENT_ONLY_FIELDS:
                if field in step_dict:
                    errors.append(f"{prefix}: '{field}' is not allowed on {source} steps")

        # Tool call validation
        tool_call_ids: Set[str] = set()
        if "tool_calls" in step_dict:
            tool_calls: object = step_dict["tool_calls"]
            if not isinstance(tool_calls, list):
                errors.append(f"{prefix}: tool_calls must be a list")
            else:
                tc_list: List[Any] = tool_calls
                for j, tc in enumerate(tc_list):
                    tc_prefix = f"{prefix}.tool_calls[{j}]"
                    if not isinstance(tc, dict):
                        errors.append(f"{tc_prefix}: must be a dict")
                        continue
                    tc_dict: dict[str, Any] = tc
                    for field in (
                        "tool_call_id",
                        "function_name",
                        "arguments",
                    ):
                        if field not in tc_dict:
                            errors.append(f"{tc_prefix}: missing required field '{field}'")
                    tc_id: object = tc_dict.get("tool_call_id")
                    if isinstance(tc_id, str):
                        tool_call_ids.add(tc_id)

        # Observation validation (independent of tool_calls)
        observation: object = step_dict.get("observation")
        if observation is not None:
            if not isinstance(observation, dict) or "results" not in observation:
                errors.append(f"{prefix}.observation: must be a dict with 'results'")
            else:
                obs_dict: dict[str, Any] = observation
                for k, result in enumerate(obs_dict["results"]):
                    r_prefix = f"{prefix}.observation.results[{k}]"
                    if not isinstance(result, dict):
                        errors.append(f"{r_prefix}: must be a dict")
                        continue
                    result_dict: dict[str, Any] = result
                    # source_call_id is optional per spec,
                    # but if present must match a tool_call_id (when tool_calls exist)
                    source_call_id: object = result_dict.get("source_call_id")
                    if (
                        isinstance(source_call_id, str)
                        and tool_call_ids  # only cross-ref if tool_calls exist
                        and source_call_id not in tool_call_ids
                    ):
                        errors.append(
                            f"{r_prefix}: source_call_id "
                            f"'{source_call_id}' does not "
                            f"match any tool_call_id in "
                            f"this step"
                        )

    if errors:
        raise ValueError("Invalid ATIF trajectory:\n" + "\n".join(f"  - {e}" for e in errors))
