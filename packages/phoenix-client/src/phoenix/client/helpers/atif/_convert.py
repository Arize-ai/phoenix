"""Convert an ATIF trajectory dict into a list of Phoenix/OTel-compatible spans."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Mapping, Optional, Sequence, Union

from phoenix.client.__generated__ import v1


def _md5_span_id(seed: str) -> str:
    """Derive a deterministic 16-hex-char span ID from a seed string."""
    return hashlib.md5(seed.encode()).hexdigest()[:16]


def _md5_trace_id(seed: str) -> str:
    """Derive a deterministic 32-hex-char trace ID from a seed string."""
    return hashlib.md5(seed.encode()).hexdigest()


def _parse_timestamp(ts: Optional[str]) -> Optional[datetime]:
    """Parse an ISO 8601 timestamp string to a timezone-aware datetime.

    Returns None if the input is None or empty.
    """
    if not ts:
        return None
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _format_timestamp(dt: datetime) -> str:
    """Format a datetime as ISO 8601 with timezone."""
    return dt.isoformat()


def _stringify_message(
    message: Union[str, list[Any], None],
) -> str:
    """Convert an ATIF message field to a plain string.

    Handles both str messages and multimodal list[ContentPart] (v1.6+).
    """
    if message is None:
        return ""
    if isinstance(message, str):
        return message
    # list[ContentPart] — concatenate text parts
    parts: list[str] = []
    for part in message:
        if isinstance(part, str):
            parts.append(part)
        elif isinstance(part, dict):
            text = part.get("text")
            if text:
                parts.append(str(text))
    return "\n".join(parts) if parts else ""


def _stringify_content(
    content: Union[str, list[Any], None],
) -> Optional[str]:
    """Convert an observation result content to a plain string.

    Returns None if content is None.
    """
    if content is None:
        return None
    if isinstance(content, str):
        return content
    return _stringify_message(content)


def _build_llm_attributes(
    step: Mapping[str, Any],
    agent: Mapping[str, Any],
) -> Dict[str, Any]:
    """Build OpenInference LLM attributes from an agent step."""
    attrs: Dict[str, Any] = {}

    # Model name (step-level overrides agent-level)
    model_name = step.get("model_name") or agent.get("model_name")
    if model_name:
        attrs["llm.model_name"] = model_name

    # Input/output values
    message = _stringify_message(step.get("message"))
    if message:
        attrs["output.value"] = message
        attrs["output.mime_type"] = "text/plain"

    # Reasoning content
    reasoning = step.get("reasoning_content")
    if reasoning:
        attrs["metadata"] = json.dumps({"reasoning_content": reasoning})

    # Token counts from metrics (spec field) or usage (common variant)
    metrics = step.get("metrics") or step.get("usage") or {}
    if metrics.get("prompt_tokens") is not None:
        attrs["llm.token_count.prompt"] = metrics["prompt_tokens"]
    if metrics.get("completion_tokens") is not None:
        attrs["llm.token_count.completion"] = metrics["completion_tokens"]
    prompt_tokens = metrics.get("prompt_tokens", 0) or 0
    completion_tokens = metrics.get("completion_tokens", 0) or 0
    if prompt_tokens or completion_tokens:
        attrs["llm.token_count.total"] = prompt_tokens + completion_tokens

    return attrs


def _build_tool_attributes(
    tool_call: Mapping[str, Any],
    observation_content: Optional[str],
) -> Dict[str, Any]:
    """Build OpenInference TOOL span attributes."""
    attrs: Dict[str, Any] = {}

    attrs["tool.name"] = tool_call.get("function_name", "unknown")
    arguments = tool_call.get("arguments")
    if arguments is not None:
        attrs["input.value"] = json.dumps(arguments)
        attrs["input.mime_type"] = "application/json"

    if observation_content is not None:
        attrs["output.value"] = observation_content
        attrs["output.mime_type"] = "text/plain"

    return attrs


def _get_step_timestamps(
    steps: Sequence[Mapping[str, Any]],
    step_index: int,
    fallback_start: datetime,
) -> tuple[datetime, datetime]:
    """Determine start/end timestamps for a step.

    Strategy:
    - If the step has a timestamp, use it as start_time.
    - Otherwise use fallback_start (previous step's end or trajectory start).
    - For end_time: use next step's timestamp if available, else start + 1s.
    """
    step = steps[step_index]
    ts = _parse_timestamp(step.get("timestamp"))
    start = ts if ts is not None else fallback_start

    # Look for the next step with a timestamp for the end
    end: Optional[datetime] = None
    for j in range(step_index + 1, len(steps)):
        next_ts = _parse_timestamp(steps[j].get("timestamp"))
        if next_ts is not None:
            end = next_ts
            break

    if end is None:
        end = start + timedelta(seconds=1)

    return start, end


def _build_message_attributes(
    steps: Sequence[Mapping[str, Any]],
    step_index: int,
) -> Dict[str, Any]:
    """Build LLM input/output message attributes for an agent step.

    Input messages are constructed from all preceding user/system steps
    since the last agent step (i.e. the conversation context for this
    agent turn). The agent's own message becomes the output message.
    """
    attrs: Dict[str, Any] = {}
    step = steps[step_index]

    # Collect input messages: walk backwards from this step to gather
    # preceding user/system messages until we hit another agent step
    input_messages: List[Dict[str, str]] = []
    for i in range(step_index - 1, -1, -1):
        prev = steps[i]
        src = prev.get("source")
        if src == "agent":
            break
        msg = _stringify_message(prev.get("message"))
        if src == "user":
            input_messages.insert(0, {"role": "user", "content": msg})
        elif src == "system":
            input_messages.insert(0, {"role": "system", "content": msg})

    for idx, msg_dict in enumerate(input_messages):
        prefix = f"llm.input_messages.{idx}"
        attrs[f"{prefix}.message.role"] = msg_dict["role"]
        attrs[f"{prefix}.message.content"] = msg_dict["content"]

    # Output message
    agent_message = _stringify_message(step.get("message"))
    if agent_message:
        attrs["llm.output_messages.0.message.role"] = "assistant"
        attrs["llm.output_messages.0.message.content"] = agent_message

    # Tool calls in output message
    tool_calls = step.get("tool_calls", [])
    for idx, tc in enumerate(tool_calls):
        tc_prefix = f"llm.output_messages.0.message.tool_calls.{idx}"
        attrs[f"{tc_prefix}.tool_call.function.name"] = tc.get("function_name", "")
        arguments = tc.get("arguments")
        if arguments is not None:
            attrs[f"{tc_prefix}.tool_call.function.arguments"] = json.dumps(arguments)

    return attrs


def _convert_atif_trajectory_to_spans(
    trajectory: Mapping[str, Any],
) -> List[v1.Span]:
    """Convert a validated ATIF trajectory into a flat list of spans.

    Span hierarchy:
      - Root AGENT span (covers entire trajectory)
        - Per-step CHAIN spans (user/system) or LLM spans (agent)
          - TOOL spans (one per tool_call in agent steps)

    IDs are deterministic, derived from session_id via MD5 so that
    re-uploading the same trajectory produces the same trace.
    """
    session_id: str = trajectory["session_id"]
    agent: Mapping[str, Any] = trajectory["agent"]
    steps: List[Mapping[str, Any]] = trajectory["steps"]

    trace_id = _md5_trace_id(f"{session_id}:trace")
    root_span_id = _md5_span_id(f"{session_id}:root")

    spans: List[v1.Span] = []

    # --- Compute trajectory time bounds ---
    # Find the first and last available timestamps; fall back to now.
    fallback_now = datetime.now(tz=timezone.utc)
    first_start: Optional[datetime] = None
    for s in steps:
        ts = _parse_timestamp(s.get("timestamp"))
        if ts is not None:
            first_start = ts
            break
    if first_start is None:
        first_start = fallback_now

    _, last_end = _get_step_timestamps(steps, len(steps) - 1, first_start)

    # --- Root AGENT span ---
    root_attrs: Dict[str, Any] = {
        "openinference.span.kind": "AGENT",
        "input.value": _get_trajectory_input(steps),
        "input.mime_type": "text/plain",
        "output.value": _get_trajectory_output(steps),
        "output.mime_type": "text/plain",
    }

    # Add agent metadata
    agent_meta: Dict[str, Any] = {
        "agent_name": agent.get("name"),
        "agent_version": agent.get("version"),
    }
    if agent.get("model_name"):
        agent_meta["model_name"] = agent["model_name"]
    if agent.get("extra"):
        agent_meta.update(agent["extra"])
    root_attrs["metadata"] = json.dumps(agent_meta)

    # Add final metrics if present
    final_metrics = trajectory.get("final_metrics")
    if final_metrics:
        total_prompt = final_metrics.get("total_prompt_tokens")
        if total_prompt is not None:
            root_attrs["llm.token_count.prompt"] = total_prompt
        total_completion = final_metrics.get("total_completion_tokens")
        if total_completion is not None:
            root_attrs["llm.token_count.completion"] = total_completion
        if total_prompt is not None or total_completion is not None:
            root_attrs["llm.token_count.total"] = (total_prompt or 0) + (total_completion or 0)

    root_span: v1.Span = {
        "name": agent.get("name", "agent"),
        "context": {
            "trace_id": trace_id,
            "span_id": root_span_id,
        },
        "span_kind": "AGENT",
        "start_time": _format_timestamp(first_start),
        "end_time": _format_timestamp(last_end),
        "status_code": "OK",
        "attributes": root_attrs,
    }
    spans.append(root_span)

    # --- Per-step spans ---
    prev_end = first_start
    for i, step in enumerate(steps):
        source = step.get("source", "agent")
        step_id = step.get("step_id", i + 1)
        step_span_id = _md5_span_id(f"{session_id}:step:{step_id}")
        step_start, step_end = _get_step_timestamps(steps, i, prev_end)
        prev_end = step_end

        if source in ("user", "system"):
            # CHAIN span for user/system messages
            step_attrs: Dict[str, Any] = {
                "openinference.span.kind": "CHAIN",
                "input.value": _stringify_message(step.get("message")),
                "input.mime_type": "text/plain",
            }
            step_span: v1.Span = {
                "name": f"{source}_message",
                "context": {
                    "trace_id": trace_id,
                    "span_id": step_span_id,
                },
                "parent_id": root_span_id,
                "span_kind": "CHAIN",
                "start_time": _format_timestamp(step_start),
                "end_time": _format_timestamp(step_end),
                "status_code": "OK",
                "attributes": step_attrs,
            }
            spans.append(step_span)

        elif source == "agent":
            # LLM span for agent steps
            llm_attrs = _build_llm_attributes(step, agent)
            llm_attrs["openinference.span.kind"] = "LLM"
            llm_attrs.update(_build_message_attributes(steps, i))

            step_span = {
                "name": f"llm_call_{step_id}",
                "context": {
                    "trace_id": trace_id,
                    "span_id": step_span_id,
                },
                "parent_id": root_span_id,
                "span_kind": "LLM",
                "start_time": _format_timestamp(step_start),
                "end_time": _format_timestamp(step_end),
                "status_code": "OK",
                "attributes": llm_attrs,
            }
            spans.append(step_span)

            # TOOL child spans for each tool_call
            tool_calls = step.get("tool_calls", [])
            observation = step.get("observation", {})
            results = observation.get("results", []) if observation else []
            # Build lookup: source_call_id → content string
            obs_map: Dict[str, str] = {}
            for r in results:
                if not isinstance(r, dict):
                    continue
                scid = r.get("source_call_id")
                if not isinstance(scid, str):
                    continue
                content_str = _stringify_content(r.get("content"))
                if content_str is not None:
                    obs_map[scid] = content_str

            for j, tc in enumerate(tool_calls):
                tc_id = tc.get("tool_call_id", f"tc_{j}")
                tool_span_id = _md5_span_id(f"{session_id}:step:{step_id}:tool:{tc_id}")
                obs_content = obs_map.get(tc_id)
                tool_attrs = _build_tool_attributes(tc, obs_content)
                tool_attrs["openinference.span.kind"] = "TOOL"

                tool_span: v1.Span = {
                    "name": tc.get("function_name", "tool_call"),
                    "context": {
                        "trace_id": trace_id,
                        "span_id": tool_span_id,
                    },
                    "parent_id": step_span_id,
                    "span_kind": "TOOL",
                    "start_time": _format_timestamp(step_start),
                    "end_time": _format_timestamp(step_end),
                    "status_code": "OK",
                    "attributes": tool_attrs,
                }
                spans.append(tool_span)

    return spans


def _get_trajectory_input(
    steps: Sequence[Mapping[str, Any]],
) -> str:
    """Extract the first user message as the trajectory input."""
    for step in steps:
        if step.get("source") == "user":
            return _stringify_message(step.get("message"))
    return ""


def _get_trajectory_output(
    steps: Sequence[Mapping[str, Any]],
) -> str:
    """Extract the last agent message as the trajectory output."""
    for step in reversed(steps):
        if step.get("source") == "agent":
            return _stringify_message(step.get("message"))
    return ""
