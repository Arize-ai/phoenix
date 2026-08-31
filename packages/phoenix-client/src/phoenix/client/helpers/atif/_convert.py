# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Convert an ATIF trajectory dict into a list of Phoenix/OTel-compatible spans."""

# Intentionally not mapped to OpenInference span attributes:
# - continued_trajectory_ref: no OpenInference equivalent for trajectory continuation
# - notes: free-form annotation with no OpenInference equivalent
# - reasoning_effort (on agent steps): configuration hint, not observable output
# - step-level extra: arbitrary vendor extensions, no standard mapping,
#   except the v1.7 context_management convention used for prompt reconstruction
#   (agent-level extra IS merged into root span metadata)
# - prompt_token_ids, completion_token_ids (in step metrics): RL training data,
#   no OpenInference attribute; arrays can be very large
# - logprobs (in step metrics): RL training data, no OpenInference attribute
#
# Mapped elsewhere (not in this "not mapped" list but worth noting):
# - subagent_trajectory_ref: resolved to cross-trace parent_id links via _build_subagent_ref_map
# - cost_usd (in step metrics): mapped to llm.cost.total on LLM spans

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Mapping, Optional, Sequence, Union

from phoenix.client.__generated__ import v1

_PARENT_SPAN_CONTEXT_KEY = "_phoenix_parent_span_context"
_FALLBACK_TIMESTAMP_KEY = "_phoenix_fallback_timestamp"
_IS_CONTINUATION_KEY = "_phoenix_is_continuation"
_CONTINUATION_INDEX_KEY = "_phoenix_continuation_index"
_STEP_NAME_KEY = "_phoenix_step_name"
_LLM_LATENCY_MS_KEY = "_phoenix_llm_latency_ms"
_LLM_LATENCY_SOURCE_KEY = "_phoenix_llm_latency_source"
_SPAN_ORDER_METADATA_KEY = "_phoenix.span_order"


def _sha256_span_id(seed: str) -> str:
    """Derive a deterministic 16-hex-char span ID from a seed string."""
    return hashlib.sha256(seed.encode()).hexdigest()[:16]


def _sha256_trace_id(seed: str) -> str:
    """Derive a deterministic 32-hex-char trace ID from a seed string."""
    return hashlib.sha256(seed.encode()).hexdigest()[:32]


def _update_metadata(attributes: Dict[str, Any], values: Mapping[str, Any]) -> None:
    """Merge converter metadata without replacing producer metadata."""
    metadata = attributes.setdefault("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}
        attributes["metadata"] = metadata
    metadata.update(values)


def _stable_trajectory_hash(trajectory: Mapping[str, Any]) -> str:
    """Derive a stable fallback identity for trajectories without IDs."""
    trajectory_for_hash = {
        key: value for key, value in trajectory.items() if not key.startswith("_phoenix_")
    }
    serialized = json.dumps(trajectory_for_hash, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode()).hexdigest()[:16]


def _trajectory_session_id(
    trajectory: Mapping[str, Any],
    fallback_session_id: Optional[str] = None,
) -> str:
    """Return the run-scoped session identity used for ``session.id``."""
    session_id = trajectory.get("session_id")
    if isinstance(session_id, str) and session_id.strip():
        return session_id
    if fallback_session_id:
        return fallback_session_id
    trajectory_id = trajectory.get("trajectory_id")
    if isinstance(trajectory_id, str) and trajectory_id.strip():
        return trajectory_id
    return f"atif-{_stable_trajectory_hash(trajectory)}"


def _trajectory_span_seed(
    trajectory: Mapping[str, Any],
    trace_id: Optional[str] = None,
) -> str:
    """Return the document-scoped identity used for deterministic span IDs."""
    minor = _schema_minor_version(trajectory) or 0
    trajectory_id = trajectory.get("trajectory_id")
    if isinstance(trajectory_id, str) and trajectory_id.strip():
        seed = trajectory_id
    elif minor >= 7:
        seed = f"atif-{_stable_trajectory_hash(trajectory)}"
    else:
        return _trajectory_session_id(trajectory)
    return f"{trace_id}:{seed}" if minor >= 7 and trace_id else seed


def _trajectory_trace_seed(trajectory: Mapping[str, Any]) -> str:
    """Return the run-scoped identity used for deterministic trace IDs."""
    session_id = trajectory.get("session_id")
    if isinstance(session_id, str) and session_id.strip():
        if (
            (_schema_minor_version(trajectory) or 0) >= 7
            and "trajectory_id" not in trajectory
            and session_id == _base_session_id(session_id)
            and not trajectory.get("continued_trajectory_ref")
        ):
            return f"atif-{_stable_trajectory_hash(trajectory)}"
        return _base_session_id(session_id)
    return _trajectory_span_seed(trajectory)


def _trajectory_lookup_keys(trajectory: Mapping[str, Any]) -> List[str]:
    """Return supported ref-map keys for a trajectory, preferred first."""
    keys: List[str] = []
    trajectory_id = trajectory.get("trajectory_id")
    if isinstance(trajectory_id, str) and trajectory_id.strip():
        keys.append(trajectory_id)
    session_id = trajectory.get("session_id")
    if isinstance(session_id, str) and session_id.strip():
        keys.append(session_id)
    return keys


def _schema_minor_version(trajectory: Mapping[str, Any]) -> Optional[int]:
    schema_version = trajectory.get("schema_version")
    if not isinstance(schema_version, str) or "-v" not in schema_version:
        return None
    try:
        return int(schema_version.split("-v", 1)[1].split(".", 1)[1])
    except (IndexError, ValueError):
        return None


def _subagent_ref_lookup_keys(
    ref: Mapping[str, Any],
    parent_trajectory: Mapping[str, Any],
) -> List[str]:
    """Return ref-map keys for a subagent ref.

    ATIF v1.7 resolves embedded refs by trajectory_id. Pre-v1.7 files used
    session_id as the child lookup key, so keep that path for existing data.
    """
    keys: List[str] = []
    trajectory_id = ref.get("trajectory_id")
    if isinstance(trajectory_id, str) and trajectory_id.strip():
        keys.append(trajectory_id)

    minor = _schema_minor_version(parent_trajectory)
    if minor is None or minor < 7:
        session_id = ref.get("session_id")
        if isinstance(session_id, str) and session_id.strip():
            keys.append(session_id)
    return keys


def _get_parent_span_context(
    trajectory: Mapping[str, Any],
    ref_map: Mapping[str, tuple[str, str]],
) -> Optional[tuple[str, str]]:
    """Return the parent span context for a trajectory if a subagent ref links it."""
    parent_ctx = trajectory.get(_PARENT_SPAN_CONTEXT_KEY)
    if (
        isinstance(parent_ctx, tuple)
        and len(parent_ctx) == 2
        and all(isinstance(value, str) for value in parent_ctx)
    ):
        return parent_ctx
    for key in _trajectory_lookup_keys(trajectory):
        parent_ctx = ref_map.get(key)
        if parent_ctx is not None:
            return parent_ctx
    return None


def _is_compaction_step(step: Mapping[str, Any]) -> bool:
    """Return whether a step records producer context management (compaction)."""
    extra = step.get("extra")
    context_management = extra.get("context_management") if isinstance(extra, Mapping) else None
    return bool(context_management)


def _measured_latency_ms(step: Mapping[str, Any]) -> Optional[float]:
    """Return adapter-supplied LLM latency without interpreting vendor metrics."""
    raw_latency_ms = step.get(_LLM_LATENCY_MS_KEY)
    if (
        not isinstance(raw_latency_ms, (int, float))
        or isinstance(raw_latency_ms, bool)
        or raw_latency_ms < 0
    ):
        return None
    return float(raw_latency_ms)


def _is_operational_step(step: Mapping[str, Any]) -> bool:
    """Return whether a fresh ATIF step represents observable execution."""
    extra = step.get("extra")
    context_management = extra.get("context_management") if isinstance(extra, Mapping) else None
    return (
        step.get("source") == "agent"
        or bool(step.get("tool_calls"))
        or bool(step.get("observation"))
        or bool(context_management)
    )


def _operation_span_id(span_seed: str, step_id: object) -> str:
    return _sha256_span_id(f"{span_seed}:step:{step_id}:operation")


def _subagent_parent_span_id(
    step: Mapping[str, Any],
    result: Mapping[str, Any],
    span_seed: str,
) -> str:
    """Resolve a subagent to the closest span the ATIF document can prove.

    A matching ``source_call_id`` attaches the child to that tool call. A
    fresh observation without a matching tool call attaches to the ATIF step
    operation. Callers exclude copied history because it cannot own fresh
    execution in this document.
    """
    source_call_id = result.get("source_call_id")
    tool_call_ids = {
        tool_call.get("tool_call_id")
        for tool_call in step.get("tool_calls", [])
        if isinstance(tool_call, Mapping)
    }
    if isinstance(source_call_id, str) and source_call_id in tool_call_ids:
        return _sha256_span_id(f"{span_seed}:step:{step.get('step_id')}:tool:{source_call_id}")
    if _is_operational_step(step):
        return _operation_span_id(span_seed, step.get("step_id"))
    return _sha256_span_id(f"{span_seed}:root")


def _flatten_atif_trajectories(
    trajectories: Sequence[Mapping[str, Any]],
) -> List[Mapping[str, Any]]:
    """Return top-level and embedded ATIF v1.7 subagent trajectories.

    Embedded subagents may omit ``session_id`` in v1.7. When they do, they
    inherit the nearest parent run identity for Phoenix's ``session.id`` while
    still using their own ``trajectory_id`` for deterministic span IDs.
    Embedded refs resolved against their containing parent carry Phoenix-only
    parent span context under ``_PARENT_SPAN_CONTEXT_KEY`` so duplicate child
    IDs in different parents are resolved locally.
    """
    flattened: List[Mapping[str, Any]] = []

    def visit(
        trajectory: Mapping[str, Any],
        inherited_session_id: Optional[str] = None,
        parent_span_context: Optional[tuple[str, str]] = None,
    ) -> None:
        effective_session_id = _trajectory_session_id(trajectory, inherited_session_id)
        if "session_id" not in trajectory and inherited_session_id:
            trajectory_for_conversion: Mapping[str, Any] = {
                **trajectory,
                "session_id": inherited_session_id,
            }
        else:
            trajectory_for_conversion = trajectory
        if parent_span_context is not None:
            # This flattened view is converter-internal; stable hash inputs drop
            # Phoenix-private keys before deriving fallback document identity.
            trajectory_for_conversion = {
                **trajectory_for_conversion,
                _PARENT_SPAN_CONTEXT_KEY: parent_span_context,
            }
        flattened.append(trajectory_for_conversion)

        subagent_trajectories = trajectory.get("subagent_trajectories")
        if not isinstance(subagent_trajectories, list):
            return
        if parent_span_context is not None:
            trace_id = parent_span_context[1]
        else:
            trace_id = _sha256_trace_id(
                f"{_trajectory_trace_seed(trajectory_for_conversion)}:trace"
            )
        span_seed = _trajectory_span_seed(trajectory_for_conversion, trace_id)
        local_ref_map: Dict[str, tuple[str, str]] = {}
        for step in trajectory_for_conversion.get("steps", []):
            if step.get("is_copied_context", False):
                continue
            observation = step.get("observation")
            if not isinstance(observation, Mapping):
                continue
            results = observation.get("results")
            if not isinstance(results, list):
                continue
            for result in results:
                if not isinstance(result, Mapping):
                    continue
                refs = result.get("subagent_trajectory_ref", [])
                if not isinstance(refs, list):
                    continue
                parent_span_id = _subagent_parent_span_id(
                    step,
                    result,
                    span_seed,
                )
                for ref in refs:
                    if not isinstance(ref, Mapping):
                        continue
                    for key in _subagent_ref_lookup_keys(ref, trajectory_for_conversion):
                        local_ref_map.setdefault(key, (parent_span_id, trace_id))
        for subagent in subagent_trajectories:
            if isinstance(subagent, Mapping):
                subagent_parent_ctx = None
                for key in _trajectory_lookup_keys(subagent):
                    subagent_parent_ctx = local_ref_map.get(key)
                    if subagent_parent_ctx is not None:
                        break
                visit(subagent, effective_session_id, subagent_parent_ctx)

    for trajectory in trajectories:
        visit(trajectory)
    return flattened


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
    # Concatenate text parts and use a path placeholder for referenced media.
    parts: list[str] = []
    for part in message:
        if isinstance(part, str):
            parts.append(part)
        elif isinstance(part, dict):
            text: object = part.get("text")
            if text:
                parts.append(str(text))
            elif part.get("type") in {"image", "audio"} and isinstance(part.get("source"), dict):
                part_type = part["type"]
                path = part["source"].get("path", "unknown")
                parts.append(f"[{part_type}: {path}]")
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


def _stringify_observation_results(results: Sequence[Any]) -> str:
    """Convert observation result contents to a compact context string."""
    parts: list[str] = []
    for result in results:
        if not isinstance(result, dict):
            continue
        content = _stringify_content(result.get("content"))
        if content:
            parts.append(content)
    return "\n".join(parts)


def _has_multimodal_content(message: Union[str, list[Any], None]) -> bool:
    """Check whether a message contains non-text content parts."""
    if not isinstance(message, list):
        return False
    return any(isinstance(part, dict) and part.get("type") != "text" for part in message)


def _build_content_part_attributes(prefix: str, parts: list[Any]) -> Dict[str, Any]:
    """Build OpenInference ``message.contents`` attributes for multimodal parts.

    Writes the standard attribute pattern::

        {prefix}.message.contents.{j}.message_content.type = "text" | "image"
        {prefix}.message.contents.{j}.message_content.text = "..."
        {prefix}.message.contents.{j}.message_content.image.image.url = "..."
    """
    attrs: Dict[str, Any] = {}
    for j, part in enumerate(parts):
        cp = f"{prefix}.message.contents.{j}.message_content"
        if isinstance(part, str):
            attrs[f"{cp}.type"] = "text"
            attrs[f"{cp}.text"] = part
        elif isinstance(part, dict):
            part_type = part.get("type", "text")
            attrs[f"{cp}.type"] = part_type
            if part_type == "text":
                text = part.get("text")
                if text:
                    attrs[f"{cp}.text"] = str(text)
            elif part_type == "image" and isinstance(part.get("source"), dict):
                path = part["source"].get("path", "")
                if path:
                    attrs[f"{cp}.image.image.url"] = path
    return attrs


def _serialize_input_messages(
    input_messages: Sequence[Mapping[str, Any]],
) -> str:
    """Serialize prompt messages without leaking internal helper fields."""
    serialized_messages: list[dict[str, Any]] = []
    for message in input_messages:
        serialized: dict[str, Any] = {}
        for key, value in message.items():
            if key == "_raw_parts":
                serialized["content"] = value
            else:
                serialized[key] = value
        serialized_messages.append(serialized)
    return json.dumps(serialized_messages)


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
        attrs["metadata"] = {"reasoning_content": reasoning}

    # Token counts from the spec "metrics" field.
    metrics: Dict[str, Any] = step.get("metrics") or {}
    if metrics.get("prompt_tokens") is not None:
        attrs["llm.token_count.prompt"] = metrics["prompt_tokens"]
    if metrics.get("completion_tokens") is not None:
        attrs["llm.token_count.completion"] = metrics["completion_tokens"]
    prompt_tokens: int = int(metrics.get("prompt_tokens", 0) or 0)
    completion_tokens: int = int(metrics.get("completion_tokens", 0) or 0)
    if prompt_tokens or completion_tokens:
        attrs["llm.token_count.total"] = prompt_tokens + completion_tokens
    # Cache token details
    if metrics.get("cached_tokens") is not None:
        attrs["llm.token_count.prompt_details.cache_read"] = metrics["cached_tokens"]

    # Cost
    if metrics.get("cost_usd") is not None:
        attrs["llm.cost.total"] = metrics["cost_usd"]

    if step.get("llm_call_count") is not None:
        attrs.setdefault("metadata", {})["llm_call_count"] = step["llm_call_count"]

    # Multimodal flag
    if _has_multimodal_content(step.get("message")):
        attrs.setdefault("metadata", {})["has_multimodal_content"] = True

    message_parts = step.get("message")
    if isinstance(message_parts, list):
        media_parts: list[dict[str, Any]] = []
        for index, part in enumerate(message_parts):
            if not isinstance(part, Mapping) or part.get("type") not in {"image", "audio"}:
                continue
            source = part.get("source")
            if not isinstance(source, Mapping):
                continue
            media_part = {"index": index, "type": part["type"]}
            for field in ("path", "media_type", "duration_sec"):
                if source.get(field) is not None:
                    media_part[field] = source[field]
            media_parts.append(media_part)
        if media_parts:
            attrs.setdefault("metadata", {})["atif.media_parts"] = media_parts

    return attrs


def _build_tool_attributes(
    tool_call: Mapping[str, Any],
    observation_content: Optional[str],
    observation_result: Optional[Mapping[str, Any]] = None,
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

    metadata: Dict[str, Any] = {}
    if tool_call.get("extra") is not None:
        metadata["tool_call_extra"] = tool_call["extra"]
    if observation_result is not None and observation_result.get("extra") is not None:
        metadata["observation_extra"] = observation_result["extra"]
    if metadata:
        attrs["metadata"] = metadata

    return attrs


def _build_llm_tools_attributes(
    tool_definitions: Sequence[Mapping[str, Any]],
) -> Dict[str, str]:
    """Build flattened OpenInference tool definition attributes."""
    attrs: Dict[str, str] = {}
    for idx, tool_definition in enumerate(tool_definitions):
        attrs[f"llm.tools.{idx}.tool.json_schema"] = json.dumps(tool_definition)
    return attrs


def _get_step_timestamps(
    steps: Sequence[Mapping[str, Any]],
    step_index: int,
    fallback_start: datetime,
) -> tuple[datetime, datetime]:
    """Bound a step by the preceding event and its own event timestamp.

    ATIF records when a step occurred, not when it started. Missing or
    non-monotonic timestamps therefore collapse to the preceding event rather
    than inventing elapsed time.
    """
    step = steps[step_index]
    ts = _parse_timestamp(step.get("timestamp"))
    end = ts if ts is not None and ts >= fallback_start else fallback_start
    return fallback_start, end


def _get_llm_timestamps(
    step: Mapping[str, Any],
    step_start: datetime,
    step_end: datetime,
) -> tuple[datetime, datetime, Dict[str, Any]]:
    """Return measured LLM timing when an adapter supplies a latency hint.

    The measurement is bounded by the ATIF step interval. Without it, the LLM
    is an event at the step timestamp rather than assigned the whole interval.
    """
    raw_latency_ms = _measured_latency_ms(step)
    if raw_latency_ms is None:
        return step_end, step_end, {"atif.timing": "event"}

    measured_end = step_start + timedelta(milliseconds=raw_latency_ms)
    raw_source = step.get(_LLM_LATENCY_SOURCE_KEY)
    timing_source = raw_source if isinstance(raw_source, str) else "adapter"
    if measured_end <= step_end:
        return (
            step_start,
            measured_end,
            {
                "atif.timing": timing_source,
                "atif.measured_latency_ms": raw_latency_ms,
            },
        )
    return (
        step_start,
        step_end,
        {
            "atif.timing": f"{timing_source}_clamped",
            "atif.measured_latency_ms": raw_latency_ms,
        },
    )


def _build_message_attributes(
    steps: Sequence[Mapping[str, Any]],
    step_index: int,
) -> Dict[str, Any]:
    """Build LLM input/output message attributes for an agent step.

    Input messages are the full conversation history up to this step,
    reconstructed from all preceding steps. This approximates what the
    LLM would have received as its prompt, though the actual prompt
    may differ (e.g. sliding windows, summarization).
    """
    attrs: Dict[str, Any] = {}
    step = steps[step_index]

    # Build full conversation history from all prior steps,
    # including tool calls and their results. This reconstructs
    # the message array the LLM would receive as its prompt.
    input_messages: List[Dict[str, Any]] = []

    context_start_index = 0
    replacement_context: Optional[str] = None
    for i in range(step_index):
        prev = steps[i]
        extra = prev.get("extra")
        context_management = extra.get("context_management") if isinstance(extra, dict) else None
        if isinstance(context_management, dict) and context_management.get("boundary") == "replace":
            observation = prev.get("observation")
            results = observation.get("results", []) if isinstance(observation, dict) else []
            replacement_context = _stringify_observation_results(results)
            context_start_index = i + 1

    if replacement_context is not None:
        input_messages.append({"role": "system", "content": replacement_context})

    for i in range(context_start_index, step_index):
        prev = steps[i]
        src = prev.get("source")
        raw_msg = prev.get("message")
        msg = _stringify_message(raw_msg)

        if src == "user" and msg:
            entry: Dict[str, Any] = {"role": "user", "content": msg}
            if isinstance(raw_msg, list):
                entry["_raw_parts"] = raw_msg
            input_messages.append(entry)
        elif src == "system" and msg:
            entry = {"role": "system", "content": msg}
            if isinstance(raw_msg, list):
                entry["_raw_parts"] = raw_msg
            input_messages.append(entry)
        elif src == "agent":
            # Assistant message (may include tool calls)
            assistant_msg: Dict[str, Any] = {
                "role": "assistant",
            }
            if msg:
                assistant_msg["content"] = msg
            if isinstance(raw_msg, list):
                assistant_msg["_raw_parts"] = raw_msg
            # Include tool calls if present
            prev_tool_calls = prev.get("tool_calls", [])
            if prev_tool_calls:
                assistant_msg["tool_calls"] = [
                    {
                        "id": tc.get("tool_call_id", ""),
                        "function": {
                            "name": tc.get("function_name", ""),
                            "arguments": json.dumps(tc.get("arguments", {})),
                        },
                    }
                    for tc in prev_tool_calls
                ]
            input_messages.append(assistant_msg)

            # Add tool result messages from observation
            observation = prev.get("observation")
            if observation and prev_tool_calls:
                results = observation.get("results", [])
                obs_map: Dict[str, str] = {}
                for r in results:
                    if isinstance(r, dict):
                        scid: object = r.get("source_call_id")
                        if isinstance(scid, str):
                            c = _stringify_content(r.get("content"))
                            if c is not None:
                                obs_map[scid] = c
                for tc in prev_tool_calls:
                    tc_id = tc.get("tool_call_id", "")
                    tc_result = obs_map.get(tc_id, "")
                    input_messages.append(
                        {
                            "role": "tool",
                            "content": tc_result,
                            "tool_call_id": tc_id,
                        }
                    )

    for idx, msg_dict in enumerate(input_messages):
        prefix = f"llm.input_messages.{idx}"
        attrs[f"{prefix}.message.role"] = msg_dict["role"]
        if "_raw_parts" in msg_dict:
            # Write multimodal content through the message.contents array.
            attrs.update(_build_content_part_attributes(prefix, msg_dict["_raw_parts"]))
        elif "content" in msg_dict:
            attrs[f"{prefix}.message.content"] = msg_dict["content"]
        if "tool_call_id" in msg_dict:
            attrs[f"{prefix}.message.tool_call_id"] = msg_dict["tool_call_id"]
        # Tool calls on assistant messages
        if "tool_calls" in msg_dict:
            for tc_idx, tc in enumerate(msg_dict["tool_calls"]):
                tc_pf = f"{prefix}.message.tool_calls.{tc_idx}"
                if "id" in tc:
                    attrs[f"{tc_pf}.tool_call.id"] = tc["id"]
                fn = tc.get("function", {})
                if "name" in fn:
                    attrs[f"{tc_pf}.tool_call.function.name"] = fn["name"]
                if "arguments" in fn:
                    attrs[f"{tc_pf}.tool_call.function.arguments"] = fn["arguments"]

    # Set input.value to the JSON representation of input messages,
    # matching how real instrumented traces store it.
    if input_messages:
        attrs["input.value"] = _serialize_input_messages(input_messages)
        attrs["input.mime_type"] = "application/json"

    # Output message
    raw_output = step.get("message")
    agent_message = _stringify_message(raw_output)
    if agent_message:
        attrs["llm.output_messages.0.message.role"] = "assistant"
        if isinstance(raw_output, list):
            attrs.update(_build_content_part_attributes("llm.output_messages.0", raw_output))
        else:
            attrs["llm.output_messages.0.message.content"] = agent_message

    # Tool calls in output message
    tool_calls = step.get("tool_calls", [])
    for idx, tc in enumerate(tool_calls):
        tc_prefix = f"llm.output_messages.0.message.tool_calls.{idx}"
        attrs[f"{tc_prefix}.tool_call.function.name"] = tc.get("function_name", "")
        tc_id = tc.get("tool_call_id")
        if tc_id:
            attrs[f"{tc_prefix}.tool_call.id"] = tc_id
        arguments = tc.get("arguments")
        if arguments is not None:
            attrs[f"{tc_prefix}.tool_call.function.arguments"] = json.dumps(arguments)

    return attrs


def _build_subagent_ref_map(
    trajectories: Sequence[Mapping[str, Any]],
) -> Dict[str, tuple[str, str]]:
    """Scan trajectories for subagent_trajectory_ref entries.

    Embedded refs flattened by _flatten_atif_trajectories may already carry
    parent context under _PARENT_SPAN_CONTEXT_KEY. This map remains necessary
    for non-embedded batch links and older separate-trajectory refs.

    Trace IDs are derived from the run-scoped session identity and tool
    span IDs from the document-scoped trajectory identity,
    matching the deterministic IDs produced by the converter.

    Returns:
        Dict mapping child resolution key -> (parent_tool_span_id, parent_trace_id)
    """
    ref_map: Dict[str, tuple[str, str]] = {}
    for trajectory in trajectories:
        parent_ctx = _get_parent_span_context(trajectory, ref_map)
        if parent_ctx is not None:
            trace_id = parent_ctx[1]
        else:
            trace_id = _sha256_trace_id(f"{_trajectory_trace_seed(trajectory)}:trace")
        span_seed = _trajectory_span_seed(trajectory, trace_id)
        for step in trajectory.get("steps", []):
            if step.get("is_copied_context", False):
                continue
            observation = step.get("observation")
            if not observation:
                continue
            for result in observation.get("results", []):
                if not isinstance(result, dict):
                    continue
                refs = result.get("subagent_trajectory_ref", [])
                if not isinstance(refs, list):
                    continue
                for ref in refs:
                    if not isinstance(ref, dict):
                        continue
                    parent_span_id = _subagent_parent_span_id(
                        step,
                        result,
                        span_seed,
                    )
                    for key in _subagent_ref_lookup_keys(ref, trajectory):
                        ref_map.setdefault(key, (parent_span_id, trace_id))
    return ref_map


def _split_into_turns(
    steps: Sequence[Mapping[str, Any]],
) -> List[List[int]]:
    """Split step indices into turns based on user messages.

    A turn is one fresh user request plus the agent activity that answers it.
    A user message therefore starts a new turn only when the current turn
    already contains agent activity: leading system steps and consecutive
    user/system context messages (some producers record environment context
    as extra user steps) group into the turn they introduce instead of
    creating empty turns.

    Returns a list of lists of step indices.
    """
    turns: List[List[int]] = []
    current: List[int] = []
    current_has_agent_activity = False
    for i, step in enumerate(steps):
        if step.get("source") == "user" and current and current_has_agent_activity:
            turns.append(current)
            current = []
            current_has_agent_activity = False
        current.append(i)
        if step.get("source") == "agent":
            current_has_agent_activity = True
    if current:
        turns.append(current)
    return turns


def _base_session_id(session_id: str) -> str:
    """Extract the base session_id, stripping any continuation suffix.

    Harbor appends ``-cont-{N}`` to the session_id for continuation
    trajectories (context window splits). We derive trace_id from the
    base so that the original and all continuations share one trace.

    Examples::

        "abc123"         -> "abc123"
        "abc123-cont-1"  -> "abc123"
        "abc123-cont-2"  -> "abc123"
    """
    parts = session_id.rsplit("-cont-", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0]
    return session_id


def _get_turn_input(
    steps: Sequence[Mapping[str, Any]],
    step_indices: Sequence[int],
) -> str:
    """Extract the user message that starts a turn."""
    for idx in step_indices:
        if steps[idx].get("source") == "user":
            return _stringify_message(steps[idx].get("message"))
    # Fallback: first non-empty message in the turn
    for idx in step_indices:
        msg = _stringify_message(steps[idx].get("message"))
        if msg:
            return msg
    return ""


def _get_turn_output(
    steps: Sequence[Mapping[str, Any]],
    step_indices: Sequence[int],
) -> str:
    """Extract the last agent reply in a turn."""
    for idx in reversed(step_indices):
        if steps[idx].get("source") == "agent":
            return _stringify_message(steps[idx].get("message"))
    return ""


def _convert_atif_trajectory_to_spans(
    trajectory: Mapping[str, Any],
    parent_span_context: Optional[tuple[str, str]] = None,
    root_span_order: int = 0,
) -> List[v1.Span]:
    """Convert a validated ATIF trajectory into a flat list of spans.

    Produces one trace per trajectory. Each fresh operational ATIF step owns
    a CHAIN span. For multi-turn conversations, each user turn gets a nested
    AGENT span under the root:

    Single-turn::

        AGENT (root)
          CHAIN agent_action_1
            LLM
            TOOL
          CHAIN agent_action_2
            LLM

    Multi-turn::

        AGENT (root)
          AGENT (turn 1, input=user msg 1, output=agent reply 1)
            CHAIN agent_action_1
              LLM
              TOOL
          AGENT (turn 2, input=user msg 2, output=agent reply 2)
            CHAIN agent_action_2
              LLM

    Visible CHAIN names number fresh operational steps with deterministic
    per-label ordinals (``agent_action_N``, ``system_action_N``, or
    ``compaction_N`` for context-management steps. The N counts steps of that
    label only. The producer's original ``step_id`` stays in span metadata as
    ``atif.step_id``. Continuation roots
    are labeled ``<agent> (continuation N)`` and Harbor multi-step roots are
    qualified with their step name.

    User messages remain prompt context. An operational system step, such as
    a handoff observation, gets a CHAIN span so referenced child work has a
    causal parent. Copied-context steps contribute only to reconstructed LLM
    prompts and never create execution spans or elapsed time.

    ATIF step timestamps are point events. Operation spans cover the interval
    from the preceding fresh event to their own event. LLM spans use an
    adapter-supplied measurement when available and bounded by that interval;
    otherwise LLM and TOOL spans are point events at the exact ATIF timestamp.
    Internal span order metadata is the display tie-break for equal timestamps.

    IDs are deterministic: trace IDs usually use the run-scoped session
    identity, while span IDs use the document-scoped trajectory identity
    when present. ATIF v1.7 standalone trajectories without
    ``trajectory_id`` use a stable document hash for trace/span IDs so
    independent trajectory documents that share a run-scoped ``session_id``
    do not collide. Re-uploading the same trajectory produces the same
    trace.

    Args:
        trajectory: A validated ATIF trajectory dict.
        parent_span_context: Optional (parent_span_id, parent_trace_id) tuple
            for linking child trajectories to the closest proven parent
            operation.
        root_span_order: Stable document order used only to break equal-time
            display ties between trajectory roots.
    """
    session_id = _trajectory_session_id(trajectory)
    agent: Mapping[str, Any] = trajectory["agent"]
    steps: List[Mapping[str, Any]] = trajectory["steps"]

    if parent_span_context is not None:
        trace_id = parent_span_context[1]
    else:
        # Derive trace_id from the base session_id so that continuation
        # trajectories (session_id ending in -cont-N) share one trace.
        trace_id = _sha256_trace_id(f"{_trajectory_trace_seed(trajectory)}:trace")
    span_seed = _trajectory_span_seed(trajectory, trace_id)
    root_span_id = _sha256_span_id(f"{span_seed}:root")

    # Copied context reconstructs prompts, but it is not execution performed by
    # this trajectory. Exclude it from spans, turns, and trajectory timing.
    execution_step_indices = [
        i for i, step in enumerate(steps) if not step.get("is_copied_context", False)
    ]

    # --- Compute execution-step timings upfront ---
    fallback_now = _parse_timestamp(trajectory.get(_FALLBACK_TIMESTAMP_KEY))
    if fallback_now is None:
        fallback_now = datetime.now(tz=timezone.utc)
    first_start: Optional[datetime] = None
    for i in execution_step_indices:
        step = steps[i]
        ts = _parse_timestamp(step.get("timestamp"))
        if ts is not None:
            first_start = ts
            # A continuation (or any document whose first fresh event is an
            # agent step) has no preceding event to open its interval, so
            # anchor the document that far before its first event using the
            # producer's own LLM latency measurement. Without it, the first
            # step honestly stays a point event.
            if step.get("source") == "agent" and step.get("llm_call_count") != 0:
                latency_ms = _measured_latency_ms(step)
                if latency_ms is not None:
                    first_start = ts - timedelta(milliseconds=latency_ms)
            break
    if first_start is None:
        first_start = fallback_now

    step_timings: Dict[int, tuple[datetime, datetime]] = {}
    prev_end = first_start
    for i in execution_step_indices:
        step_start, step_end = _get_step_timestamps(steps, i, prev_end)
        step_timings[i] = (step_start, step_end)
        prev_end = step_end
    last_end = prev_end

    # --- Shared attributes ---
    tool_definitions = agent.get("tool_definitions")
    llm_tool_attrs: Dict[str, str] = {}
    if tool_definitions:
        llm_tool_attrs = _build_llm_tools_attributes(tool_definitions)

    agent_meta: Dict[str, Any] = {
        "agent_name": agent.get("name"),
        "agent_version": agent.get("version"),
    }
    trajectory_id = trajectory.get("trajectory_id")
    if isinstance(trajectory_id, str) and trajectory_id.strip():
        agent_meta["trajectory_id"] = trajectory_id
    if agent.get("model_name"):
        agent_meta["model_name"] = agent["model_name"]
    if agent.get("extra"):
        agent_meta.update(agent["extra"])

    all_spans: List[v1.Span] = []

    # --- Root AGENT span (trajectory-level) ---
    raw_session_id = trajectory.get("session_id")
    is_continuation = bool(trajectory.get(_IS_CONTINUATION_KEY)) or (
        isinstance(raw_session_id, str) and raw_session_id != _base_session_id(raw_session_id)
    )
    root_meta = dict(agent_meta)
    root_meta[_SPAN_ORDER_METADATA_KEY] = root_span_order
    root_name = str(agent.get("name") or "agent")
    step_name = trajectory.get(_STEP_NAME_KEY)
    if isinstance(step_name, str) and step_name:
        root_name = f"{root_name} · {step_name}"
        root_meta["harbor.step_name"] = step_name
    if is_continuation:
        root_meta["is_continuation"] = True
        continuation_index = trajectory.get(_CONTINUATION_INDEX_KEY)
        if isinstance(continuation_index, int) and continuation_index > 0:
            root_name = f"{root_name} (continuation {continuation_index})"
            root_meta["continuation_index"] = continuation_index
        else:
            root_name = f"{root_name} (continuation)"
    root_attrs: Dict[str, Any] = {
        "openinference.span.kind": "AGENT",
        "session.id": session_id,
        "input.value": _get_trajectory_input(steps),
        "input.mime_type": "text/plain",
        "output.value": _get_trajectory_output(steps),
        "output.mime_type": "text/plain",
        "metadata": root_meta,
    }

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
        total_cost = final_metrics.get("total_cost_usd")
        if total_cost is not None:
            root_attrs["llm.cost.total"] = total_cost

    root_span: v1.Span = {
        "name": root_name,
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
    if parent_span_context is not None:
        root_span["parent_id"] = parent_span_context[0]
    all_spans.append(root_span)

    # --- Split into turns ---
    execution_steps = [steps[i] for i in execution_step_indices]
    turns = [
        [execution_step_indices[i] for i in turn] for turn in _split_into_turns(execution_steps)
    ]
    multi_turn = len(turns) > 1

    # Visible action names use deterministic per-label ordinals over fresh
    # operational steps: ``agent_action_3`` is the third agent action and
    # ``compaction_1`` the first compaction, regardless of interleaving. The
    # original ATIF ``step_id`` (which counts prompt context such as the user
    # instruction) stays in metadata, and global execution order lives in
    # timestamps and ``_phoenix.span_order``, so names never encode it.
    operation_names: Dict[int, str] = {}
    label_ordinals: Dict[str, int] = {}
    for i in execution_step_indices:
        step = steps[i]
        if not _is_operational_step(step):
            continue
        if _is_compaction_step(step):
            label = "compaction"
        else:
            label = f"{step.get('source', 'unknown')}_action"
        label_ordinals[label] = label_ordinals.get(label, 0) + 1
        operation_names[i] = f"{label}_{label_ordinals[label]}"

    for turn_idx, step_indices in enumerate(turns):
        # For multi-turn: create a nested AGENT span per turn.
        # For single-turn: LLM spans parent directly to the root.
        if multi_turn:
            turn_span_id = _sha256_span_id(f"{span_seed}:turn:{turn_idx}")
            turn_start = step_timings[step_indices[0]][1]
            turn_end = step_timings[step_indices[-1]][1]
            turn_attrs: Dict[str, Any] = {
                "openinference.span.kind": "AGENT",
                "session.id": session_id,
                "input.value": _get_turn_input(steps, step_indices),
                "input.mime_type": "text/plain",
                "output.value": _get_turn_output(steps, step_indices),
                "output.mime_type": "text/plain",
                "metadata": {_SPAN_ORDER_METADATA_KEY: turn_idx},
            }
            turn_span: v1.Span = {
                "name": f"turn_{turn_idx + 1}",
                "context": {
                    "trace_id": trace_id,
                    "span_id": turn_span_id,
                },
                "parent_id": root_span_id,
                "span_kind": "AGENT",
                "start_time": _format_timestamp(turn_start),
                "end_time": _format_timestamp(turn_end),
                "status_code": "OK",
                "attributes": turn_attrs,
            }
            all_spans.append(turn_span)
            operation_parent_id = turn_span_id
        else:
            operation_parent_id = root_span_id

        # --- ATIF operation + LLM/TOOL spans ---
        for i in step_indices:
            step = steps[i]
            if not _is_operational_step(step):
                continue

            step_id = step.get("step_id", i + 1)
            operation_span_id = _operation_span_id(span_seed, step_id)
            step_start, step_end = step_timings[i]
            source = str(step.get("source", "unknown"))
            operation_metadata: Dict[str, Any] = {
                "atif.step_id": step_id,
                "atif.source": source,
                "atif.timing": "event_interval",
                _SPAN_ORDER_METADATA_KEY: i,
            }
            if _is_compaction_step(step):
                operation_metadata["atif.context_management"] = True
            operation_attrs: Dict[str, Any] = {
                "openinference.span.kind": "CHAIN",
                "session.id": session_id,
                "metadata": operation_metadata,
            }
            # Pair observation results with tool calls before building the
            # operation span so the operation can retain unmatched step-level
            # observations. Producers such as
            # Terminus record one combined observation for a whole step with
            # no ``source_call_id``.
            tool_calls = step.get("tool_calls", [])
            observation = step.get("observation", {})
            results: List[Any] = observation.get("results", []) if observation else []
            obs_map: Dict[str, Mapping[str, Any]] = {}
            unmatched_results: List[Mapping[str, Any]] = []
            tool_call_id_set = {
                tc.get("tool_call_id")
                for tc in tool_calls
                if isinstance(tc, Mapping) and tc.get("tool_call_id")
            }
            for r in results:
                if not isinstance(r, dict):
                    continue
                scid: object = r.get("source_call_id")
                if isinstance(scid, str) and scid in tool_call_id_set:
                    obs_map[scid] = r
                elif r.get("content") is not None:
                    unmatched_results.append(r)
            if (
                len(tool_calls) == 1
                and len(unmatched_results) == 1
                and isinstance(tool_calls[0], Mapping)
                and tool_calls[0].get("tool_call_id", "tc_0") not in obs_map
            ):
                # One call, one result: the pairing is unambiguous even
                # without a recorded ``source_call_id``.
                only_call_id = str(tool_calls[0].get("tool_call_id", "tc_0"))
                obs_map[only_call_id] = unmatched_results.pop()

            step_message = _stringify_message(step.get("message"))
            step_observation = (
                _stringify_observation_results(unmatched_results) if unmatched_results else ""
            )
            if source == "agent":
                if step_message and step_observation:
                    operation_attrs["output.value"] = json.dumps(
                        {"message": step_message, "observation": step_observation}
                    )
                    operation_attrs["output.mime_type"] = "application/json"
                elif step_message or step_observation:
                    operation_attrs["output.value"] = step_message or step_observation
                    operation_attrs["output.mime_type"] = "text/plain"
            else:
                if step_message:
                    operation_attrs["input.value"] = step_message
                    operation_attrs["input.mime_type"] = "text/plain"
                if step_observation:
                    operation_attrs["output.value"] = step_observation
                    operation_attrs["output.mime_type"] = "text/plain"

            operation_span: v1.Span = {
                "name": operation_names[i],
                "context": {
                    "trace_id": trace_id,
                    "span_id": operation_span_id,
                },
                "parent_id": operation_parent_id,
                "span_kind": "CHAIN",
                "start_time": _format_timestamp(step_start),
                "end_time": _format_timestamp(step_end),
                "status_code": "OK",
                "attributes": operation_attrs,
            }
            all_spans.append(operation_span)

            is_deterministic_dispatch = step.get("llm_call_count") == 0
            has_llm = source == "agent" and not is_deterministic_dispatch

            llm_is_event = has_llm and _measured_latency_ms(step) is None

            if has_llm:
                llm_span_id = _sha256_span_id(f"{span_seed}:step:{step_id}")
                if llm_is_event:
                    llm_start = llm_end = step_end
                    llm_timing_metadata: Dict[str, Any] = {"atif.timing": "event"}
                else:
                    llm_start, llm_end, llm_timing_metadata = _get_llm_timestamps(
                        step,
                        step_start,
                        step_end,
                    )
                llm_attrs = _build_llm_attributes(step, agent)
                llm_attrs["openinference.span.kind"] = "LLM"
                llm_attrs["session.id"] = session_id
                llm_attrs.update(_build_message_attributes(steps, i))
                llm_attrs.update(llm_tool_attrs)

                # Flag LLM spans whose input includes copied context
                has_copied = any(steps[j].get("is_copied_context") for j in range(i))
                if has_copied:
                    _update_metadata(llm_attrs, {"has_copied_context": True})
                _update_metadata(
                    llm_attrs,
                    {
                        "atif.step_id": step_id,
                        _SPAN_ORDER_METADATA_KEY: 0,
                        **llm_timing_metadata,
                    },
                )

                llm_span: v1.Span = {
                    "name": "LLM",
                    "context": {
                        "trace_id": trace_id,
                        "span_id": llm_span_id,
                    },
                    "parent_id": operation_span_id,
                    "span_kind": "LLM",
                    "start_time": _format_timestamp(llm_start),
                    "end_time": _format_timestamp(llm_end),
                    "status_code": "OK",
                    "attributes": llm_attrs,
                }
                all_spans.append(llm_span)

            # TOOL spans are events beneath the ATIF operation. ATIF preserves
            # declared array order but not serial/parallel execution timing.
            for j, tc in enumerate(tool_calls):
                tc_id = tc.get("tool_call_id", f"tc_{j}")
                tool_span_id = _sha256_span_id(f"{span_seed}:step:{step_id}:tool:{tc_id}")
                obs_result = obs_map.get(tc_id)
                obs_content = (
                    _stringify_content(obs_result.get("content"))
                    if obs_result is not None
                    else None
                )
                tool_attrs = _build_tool_attributes(tc, obs_content, obs_result)
                tool_attrs["openinference.span.kind"] = "TOOL"
                tool_attrs["session.id"] = session_id
                if is_deterministic_dispatch:
                    _update_metadata(tool_attrs, {"llm_call_count": 0})
                _update_metadata(
                    tool_attrs,
                    {
                        "atif.step_id": step_id,
                        "atif.tool_call_index": j,
                        "atif.timing": "event",
                        _SPAN_ORDER_METADATA_KEY: j + 1,
                    },
                )

                # ATIF does not record tool start/end times or whether calls in
                # one step ran serially or concurrently. Represent each call as
                # a zero-duration event at the step timestamp instead of
                # fabricating elapsed time.
                tool_start = step_end

                tool_span: v1.Span = {
                    "name": tc.get("function_name", "tool_call"),
                    "context": {
                        "trace_id": trace_id,
                        "span_id": tool_span_id,
                    },
                    "parent_id": operation_span_id,
                    "span_kind": "TOOL",
                    "start_time": _format_timestamp(tool_start),
                    "end_time": _format_timestamp(tool_start),
                    "status_code": "OK",
                    "attributes": tool_attrs,
                }
                all_spans.append(tool_span)

    return all_spans


def _get_trajectory_input(
    steps: Sequence[Mapping[str, Any]],
) -> str:
    """Extract the user request as the trajectory input.

    Some producers record environment context as extra leading user steps
    before the actual request (Codex, for example). The request is the last
    fresh user message before the first fresh agent step. A continuation
    document may carry its entire prompt as copied context, so copied user
    messages are the final fallback rather than an empty input.
    """
    last_user_message = ""
    for step in steps:
        if step.get("is_copied_context", False):
            continue
        if step.get("source") == "user":
            message = _stringify_message(step.get("message"))
            if message:
                last_user_message = message
        elif step.get("source") == "agent":
            break
    if last_user_message:
        return last_user_message
    for step in steps:
        if step.get("source") == "user" and not step.get("is_copied_context", False):
            return _stringify_message(step.get("message"))
    # Only copied context remains: the replayed handoff conversation is this
    # document's prompt, so its last user message before fresh agent work is
    # the request being answered.
    for step in steps:
        if step.get("source") == "user":
            message = _stringify_message(step.get("message"))
            if message:
                last_user_message = message
        elif step.get("source") == "agent" and not step.get("is_copied_context", False):
            break
    return last_user_message


def _get_trajectory_output(
    steps: Sequence[Mapping[str, Any]],
) -> str:
    """Extract the last agent message as the trajectory output."""
    for step in reversed(steps):
        if step.get("source") == "agent" and not step.get("is_copied_context", False):
            return _stringify_message(step.get("message"))
    return ""
