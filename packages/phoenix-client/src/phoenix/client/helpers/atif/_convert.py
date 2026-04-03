# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Convert an ATIF trajectory dict into a list of Phoenix/OTel-compatible spans."""

# Intentionally not mapped to OpenInference span attributes:
# - continued_trajectory_ref: no OpenInference equivalent for trajectory continuation
# - notes: free-form annotation with no OpenInference equivalent
# - reasoning_effort (on agent steps): configuration hint, not observable output
# - step-level extra: arbitrary vendor extensions, no standard mapping
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


def _sha256_span_id(seed: str) -> str:
    """Derive a deterministic 16-hex-char span ID from a seed string."""
    return hashlib.sha256(seed.encode()).hexdigest()[:16]


def _sha256_trace_id(seed: str) -> str:
    """Derive a deterministic 32-hex-char trace ID from a seed string."""
    return hashlib.sha256(seed.encode()).hexdigest()[:32]


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
    # list[ContentPart] — concatenate text parts, placeholder for images
    parts: list[str] = []
    for part in message:
        if isinstance(part, str):
            parts.append(part)
        elif isinstance(part, dict):
            text: object = part.get("text")
            if text:
                parts.append(str(text))
            elif part.get("type") == "image" and isinstance(part.get("source"), dict):
                path = part["source"].get("path", "unknown")
                parts.append(f"[image: {path}]")
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

    # Multimodal flag
    if _has_multimodal_content(step.get("message")):
        attrs.setdefault("metadata", {})["has_multimodal_content"] = True

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
    for i in range(step_index):
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
            # Multimodal content — write message.contents array
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

    Trace IDs are derived as ``sha256(session_id:trace)[:32]`` and tool
    span IDs as ``sha256(session_id:step:{step_id}:tool:{tc_id})[:16]``,
    matching the deterministic IDs produced by the converter.

    Returns:
        Dict mapping child_session_id -> (parent_tool_span_id, parent_trace_id)
    """
    ref_map: Dict[str, tuple[str, str]] = {}
    for trajectory in trajectories:
        session_id = trajectory["session_id"]
        trace_id = _sha256_trace_id(f"{_base_session_id(session_id)}:trace")
        for step in trajectory.get("steps", []):
            step_id = step.get("step_id")
            observation = step.get("observation")
            if not observation:
                continue
            for result in observation.get("results", []):
                if not isinstance(result, dict):
                    continue
                refs = result.get("subagent_trajectory_ref", [])
                for ref in refs:
                    child_session_id = ref.get("session_id")
                    if not child_session_id:
                        continue
                    tc_id = result.get("source_call_id", "")
                    parent_tool_span_id = _sha256_span_id(
                        f"{session_id}:step:{step_id}:tool:{tc_id}"
                    )
                    ref_map[child_session_id] = (parent_tool_span_id, trace_id)
    return ref_map


def _split_into_turns(
    steps: Sequence[Mapping[str, Any]],
) -> List[List[int]]:
    """Split step indices into turns based on user messages.

    The first turn includes all steps from the beginning through the
    agent/system steps that follow the first user message, up to (but
    not including) the next user message. Each subsequent user message
    starts a new turn. This means leading system/context steps before
    the first user message are grouped into the first turn rather than
    creating an empty turn.

    Returns a list of lists of step indices.
    """
    turns: List[List[int]] = []
    current: List[int] = []
    seen_first_user = False
    for i, step in enumerate(steps):
        if step.get("source") == "user":
            if seen_first_user and current:
                turns.append(current)
                current = []
            seen_first_user = True
        current.append(i)
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
    parts = session_id.split("-cont-")
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
) -> List[v1.Span]:
    """Convert a validated ATIF trajectory into a flat list of spans.

    Produces one trace per trajectory. For multi-turn conversations,
    each user turn gets a nested AGENT span under the root:

    Single-turn::

        AGENT (root)
          LLM
            TOOL
          LLM

    Multi-turn::

        AGENT (root)
          AGENT (turn 1 — input=user msg 1, output=agent reply 1)
            LLM
              TOOL
          AGENT (turn 2 — input=user msg 2, output=agent reply 2)
            LLM

    User/system messages are not separate spans — they appear as
    ``llm.input_messages`` on the LLM spans that follow them.

    IDs are deterministic, derived from session_id via SHA-256 so that
    re-uploading the same trajectory produces the same trace.

    Args:
        trajectory: A validated ATIF trajectory dict.
        parent_span_context: Optional (parent_span_id, parent_trace_id) tuple
            for linking child trajectories to a parent's tool span.
    """
    session_id: str = trajectory["session_id"]
    agent: Mapping[str, Any] = trajectory["agent"]
    steps: List[Mapping[str, Any]] = trajectory["steps"]

    if parent_span_context is not None:
        trace_id = parent_span_context[1]
    else:
        # Derive trace_id from the base session_id so that continuation
        # trajectories (session_id ending in -cont-N) share one trace.
        trace_id = _sha256_trace_id(f"{_base_session_id(session_id)}:trace")
    root_span_id = _sha256_span_id(f"{session_id}:root")

    # --- Compute step timings upfront ---
    fallback_now = datetime.now(tz=timezone.utc)
    first_start: Optional[datetime] = None
    for s in steps:
        ts = _parse_timestamp(s.get("timestamp"))
        if ts is not None:
            first_start = ts
            break
    if first_start is None:
        first_start = fallback_now

    step_timings: List[tuple[datetime, datetime]] = []
    prev_end = first_start
    for i, _step in enumerate(steps):
        step_start, step_end = _get_step_timestamps(steps, i, prev_end)
        step_timings.append((step_start, step_end))
        prev_end = step_end
    last_end = step_timings[-1][1]

    # --- Shared attributes ---
    tool_definitions = agent.get("tool_definitions")
    llm_tool_attrs: Dict[str, str] = {}
    if tool_definitions:
        llm_tool_attrs = _build_llm_tools_attributes(tool_definitions)

    agent_meta: Dict[str, Any] = {
        "agent_name": agent.get("name"),
        "agent_version": agent.get("version"),
    }
    if agent.get("model_name"):
        agent_meta["model_name"] = agent["model_name"]
    if agent.get("extra"):
        agent_meta.update(agent["extra"])

    all_spans: List[v1.Span] = []

    # --- Root AGENT span (trajectory-level) ---
    is_continuation = session_id != _base_session_id(session_id)
    root_meta = dict(agent_meta)
    if is_continuation:
        root_meta["is_continuation"] = True
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
    if parent_span_context is not None:
        root_span["parent_id"] = parent_span_context[0]
    all_spans.append(root_span)

    # --- Split into turns ---
    turns = _split_into_turns(steps)
    multi_turn = len(turns) > 1

    for turn_idx, step_indices in enumerate(turns):
        # For multi-turn: create a nested AGENT span per turn.
        # For single-turn: LLM spans parent directly to the root.
        if multi_turn:
            turn_span_id = _sha256_span_id(f"{session_id}:turn:{turn_idx}")
            turn_start = step_timings[step_indices[0]][0]
            turn_end = step_timings[step_indices[-1]][1]
            turn_attrs: Dict[str, Any] = {
                "openinference.span.kind": "AGENT",
                "session.id": session_id,
                "input.value": _get_turn_input(steps, step_indices),
                "input.mime_type": "text/plain",
                "output.value": _get_turn_output(steps, step_indices),
                "output.mime_type": "text/plain",
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
            llm_parent_id = turn_span_id
        else:
            llm_parent_id = root_span_id

        # --- LLM + TOOL spans for agent steps ---
        for i in step_indices:
            step = steps[i]
            if step.get("source") != "agent":
                continue

            step_id = step.get("step_id", i + 1)
            step_span_id = _sha256_span_id(f"{session_id}:step:{step_id}")
            step_start, step_end = step_timings[i]

            llm_attrs = _build_llm_attributes(step, agent)
            llm_attrs["openinference.span.kind"] = "LLM"
            llm_attrs["session.id"] = session_id
            llm_attrs.update(_build_message_attributes(steps, i))
            llm_attrs.update(llm_tool_attrs)

            # Flag LLM spans whose input includes copied context
            has_copied = any(steps[j].get("is_copied_context") for j in range(i))
            if has_copied:
                llm_attrs.setdefault("metadata", {})["has_copied_context"] = True

            step_span: v1.Span = {
                "name": "LLM",
                "context": {
                    "trace_id": trace_id,
                    "span_id": step_span_id,
                },
                "parent_id": llm_parent_id,
                "span_kind": "LLM",
                "start_time": _format_timestamp(step_start),
                "end_time": _format_timestamp(step_end),
                "status_code": "OK",
                "attributes": llm_attrs,
            }
            all_spans.append(step_span)

            # TOOL sibling spans (peers of LLM, both children of the AGENT)
            tool_calls = step.get("tool_calls", [])
            observation = step.get("observation", {})
            results: List[Any] = observation.get("results", []) if observation else []
            obs_map: Dict[str, str] = {}
            for r in results:
                if not isinstance(r, dict):
                    continue
                scid: object = r.get("source_call_id")
                if not isinstance(scid, str):
                    continue
                content_str = _stringify_content(r.get("content"))
                if content_str is not None:
                    obs_map[scid] = content_str

            for j, tc in enumerate(tool_calls):
                tc_id = tc.get("tool_call_id", f"tc_{j}")
                tool_span_id = _sha256_span_id(f"{session_id}:step:{step_id}:tool:{tc_id}")
                obs_content = obs_map.get(tc_id)
                tool_attrs = _build_tool_attributes(tc, obs_content)
                tool_attrs["openinference.span.kind"] = "TOOL"
                tool_attrs["session.id"] = session_id

                # Offset tool start times by 1ms per tool so the waterfall
                # sorts them after the LLM span that requested them.
                tool_start = step_start + timedelta(milliseconds=j + 1)

                tool_span: v1.Span = {
                    "name": tc.get("function_name", "tool_call"),
                    "context": {
                        "trace_id": trace_id,
                        "span_id": tool_span_id,
                    },
                    "parent_id": llm_parent_id,
                    "span_kind": "TOOL",
                    "start_time": _format_timestamp(tool_start),
                    "end_time": _format_timestamp(step_end),
                    "status_code": "OK",
                    "attributes": tool_attrs,
                }
                all_spans.append(tool_span)

    return all_spans


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
