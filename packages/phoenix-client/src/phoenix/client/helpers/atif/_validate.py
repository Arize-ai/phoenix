# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Internal validation for ATIF trajectories."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, List, Mapping, Optional, Set

logger = logging.getLogger(__name__)

_MAX_SUPPORTED_MINOR = 7

_VALID_SOURCES = {"user", "agent", "system"}
# Fields that may ONLY appear on agent steps.
# Note: tool_calls, metrics, and observation are allowed on any source since v1.2.
_AGENT_ONLY_FIELDS = {
    "model_name",
    "reasoning_content",
    "reasoning_effort",
}
_SCHEMA_VERSION_PATTERN = re.compile(r"^ATIF-v\d+\.\d+$")
_STEP_NUMERIC_METRIC_FIELDS = {
    "prompt_tokens",
    "completion_tokens",
    "cached_tokens",
    "cost_usd",
}
_FINAL_NUMERIC_METRIC_FIELDS = {
    "total_prompt_tokens",
    "total_completion_tokens",
    "total_cached_tokens",
    "total_cost_usd",
    "total_steps",
}


def _parse_schema_version(schema_version: object) -> Optional[tuple[int, int]]:
    if not isinstance(schema_version, str) or not _SCHEMA_VERSION_PATTERN.match(schema_version):
        return None
    version_part = schema_version.split("-v")[1]
    major_str, minor_str = version_part.split(".")
    return int(major_str), int(minor_str)


def _is_numeric(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _is_iso_8601_timestamp(value: str) -> bool:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def _validate_atif_trajectory(
    trajectory: Mapping[str, Any],
    *,
    _is_embedded: bool = False,
) -> None:
    """Validate an ATIF trajectory dict, raising ValueError on any issue.

    Checks:
    - Required root fields: schema_version, agent, steps
    - session_id is required before ATIF v1.7 and optional in v1.7+
    - schema_version format (ATIF-vX.Y); hard reject on major >= 2,
      warning on minor > 7 (latest supported)
    - trajectory_id is required for v1.7+ embedded subagent trajectories
    - Agent required fields: name, version (model_name is optional)
    - Steps are non-empty with sequential step_ids starting at 1
    - Step source is one of: user, agent, system
    - message is required for user/system steps, and for all v1.7+ steps
    - Agent-only fields (model_name, reasoning_content, reasoning_effort)
      only on agent steps
    - Tool call structure validation
    - Observation validation (independent of tool_calls); source_call_id
      cross-referenced against tool_call_ids when both are present
    - ATIF v1.7 embedded subagents and trajectory_id refs
    """
    errors: List[str] = []

    # Root required fields
    for field in ("schema_version", "agent", "steps"):
        if field not in trajectory:
            errors.append(f"Missing required root field: '{field}'")

    if errors:
        raise ValueError("Invalid ATIF trajectory:\n" + "\n".join(f"  - {e}" for e in errors))

    # Schema version format
    schema_version = trajectory["schema_version"]
    parsed_version = _parse_schema_version(schema_version)
    major: Optional[int] = None
    minor: Optional[int] = None
    if parsed_version is None:
        errors.append(f"Invalid schema_version '{schema_version}': expected format 'ATIF-vX.Y'")
    else:
        # Parse and check version numbers
        major, minor = parsed_version
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
    session_id = trajectory.get("session_id")
    session_required = parsed_version is None or minor is None or minor < 7
    if session_id is None:
        if session_required:
            errors.append("Missing required root field: 'session_id'")
    elif not isinstance(session_id, str) or not session_id.strip():
        errors.append("session_id must be a non-empty string")

    # Trajectory ID
    trajectory_id = trajectory.get("trajectory_id")
    if trajectory_id is not None and (
        not isinstance(trajectory_id, str) or not trajectory_id.strip()
    ):
        errors.append("trajectory_id must be a non-empty string if provided")
    if _is_embedded and minor is not None and minor >= 7 and not trajectory_id:
        errors.append("embedded subagent trajectories must set trajectory_id")

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
        if "extra" in agent and agent["extra"] is not None and not isinstance(agent["extra"], dict):
            errors.append("agent.extra must be a dict if provided")

    final_metrics = trajectory.get("final_metrics")
    if final_metrics is not None:
        if not isinstance(final_metrics, dict):
            errors.append("final_metrics must be a dict if provided")
        else:
            for field in _FINAL_NUMERIC_METRIC_FIELDS:
                value = final_metrics.get(field)
                if value is not None and not _is_numeric(value):
                    errors.append(f"final_metrics.{field} must be numeric if provided")

    # Steps validation
    raw_steps: object = trajectory["steps"]
    if not isinstance(raw_steps, list) or len(raw_steps) == 0:
        errors.append("'steps' must be a non-empty list")
        raise ValueError("Invalid ATIF trajectory:\n" + "\n".join(f"  - {e}" for e in errors))

    embedded_subagent_ids: Set[str] = set()
    subagent_trajectories = trajectory.get("subagent_trajectories")
    if subagent_trajectories is not None:
        if not isinstance(subagent_trajectories, list):
            errors.append("subagent_trajectories must be a list if provided")
        else:
            for j, subagent in enumerate(subagent_trajectories):
                s_prefix = f"subagent_trajectories[{j}]"
                if not isinstance(subagent, dict):
                    errors.append(f"{s_prefix}: must be a dict")
                    continue
                subagent_trajectory_id = subagent.get("trajectory_id")
                if (
                    not isinstance(subagent_trajectory_id, str)
                    or not subagent_trajectory_id.strip()
                ):
                    errors.append(f"{s_prefix}: trajectory_id is required")
                    continue
                if subagent_trajectory_id in embedded_subagent_ids:
                    errors.append(f"{s_prefix}: duplicate trajectory_id '{subagent_trajectory_id}'")
                embedded_subagent_ids.add(subagent_trajectory_id)
                try:
                    _validate_atif_trajectory(subagent, _is_embedded=True)
                except ValueError as e:
                    errors.append(f"{s_prefix}: {e}")

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

        timestamp: object = step_dict.get("timestamp")
        if timestamp is not None:
            if not isinstance(timestamp, str) or not _is_iso_8601_timestamp(timestamp):
                errors.append(f"{prefix}: timestamp must be ISO 8601 if provided")

        # Message required for user/system steps. ATIF v1.7 requires it for
        # all steps, including agent steps with an intentionally empty string.
        if source in ("user", "system") or (minor is not None and minor >= 7):
            msg: object = step_dict.get("message")
            if msg is None:
                if source in ("user", "system"):
                    errors.append(f"{prefix}: message is required for {source} steps")
                else:
                    errors.append(f"{prefix}: message is required for ATIF v1.7+ steps")

        if source in ("user", "system"):
            # Agent-only fields should not appear on user/system steps
            for field in _AGENT_ONLY_FIELDS:
                if field in step_dict:
                    errors.append(f"{prefix}: '{field}' is not allowed on {source} steps")

        llm_call_count = step_dict.get("llm_call_count")
        if llm_call_count is not None:
            if not isinstance(llm_call_count, int) or llm_call_count < 0:
                errors.append(f"{prefix}: llm_call_count must be a non-negative integer")
            elif source == "agent" and llm_call_count == 0:
                for field in ("metrics", "reasoning_content"):
                    if step_dict.get(field) is not None:
                        errors.append(
                            f"{prefix}: '{field}' must be absent when llm_call_count is 0"
                        )
                llm_zero_tool_calls = step_dict.get("tool_calls")
                if not isinstance(llm_zero_tool_calls, list) or not llm_zero_tool_calls:
                    errors.append(f"{prefix}: tool_calls are required when llm_call_count is 0")

        metrics = step_dict.get("metrics")
        if metrics is not None:
            if not isinstance(metrics, dict):
                errors.append(f"{prefix}: metrics must be a dict if provided")
            else:
                for field in _STEP_NUMERIC_METRIC_FIELDS:
                    value = metrics.get(field)
                    if value is not None and not _is_numeric(value):
                        errors.append(f"{prefix}: metrics.{field} must be numeric if provided")

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
                    refs: object = result_dict.get("subagent_trajectory_ref")
                    if refs is not None:
                        if not isinstance(refs, list):
                            errors.append(f"{r_prefix}: subagent_trajectory_ref must be a list")
                            continue
                        for ref_index, ref in enumerate(refs):
                            ref_prefix = f"{r_prefix}.subagent_trajectory_ref[{ref_index}]"
                            if not isinstance(ref, dict):
                                errors.append(f"{ref_prefix}: must be a dict")
                                continue
                            ref_trajectory_id = ref.get("trajectory_id")
                            ref_trajectory_path = ref.get("trajectory_path")
                            if minor is not None and minor >= 7:
                                has_trajectory_id = isinstance(ref_trajectory_id, str) and bool(
                                    ref_trajectory_id.strip()
                                )
                                has_trajectory_path = isinstance(ref_trajectory_path, str) and bool(
                                    ref_trajectory_path.strip()
                                )
                                if not has_trajectory_id:
                                    if has_trajectory_path:
                                        errors.append(
                                            f"{ref_prefix}: trajectory_path-only subagent "
                                            "references are not supported; provide "
                                            "trajectory_id for Phoenix linking"
                                        )
                                    else:
                                        errors.append(f"{ref_prefix}: trajectory_id is required")
                                if (
                                    has_trajectory_id
                                    and not has_trajectory_path
                                    and ref_trajectory_id not in embedded_subagent_ids
                                ):
                                    errors.append(
                                        f"{ref_prefix}: trajectory_id '{ref_trajectory_id}' "
                                        "does not match an embedded subagent trajectory"
                                    )

    if errors:
        raise ValueError("Invalid ATIF trajectory:\n" + "\n".join(f"  - {e}" for e in errors))
