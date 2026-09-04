# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Convert ATIF trajectories into Phoenix spans.

Each trajectory becomes one trace: a root AGENT span, an AGENT span per user
turn when there are several turns, a CHAIN span per fresh operational step,
and LLM and TOOL spans beneath each step. Spans are named by their target
(the agent, model, or tool) because the span kind already names the
operation; iterations and turns use ATIF vocabulary.

ATIF fields with no OpenInference equivalent (``notes``, ``reasoning_effort``,
token ID arrays, and logprobs) are not mapped.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterator, List, Mapping, Optional, Sequence, Union, cast

from phoenix.client.__generated__ import v1

# Phoenix-private keys that adapters may add to a trajectory before conversion.
_PARENT_SPAN_CONTEXT_KEY = "_phoenix_parent_span_context"
_FALLBACK_TIMESTAMP_KEY = "_phoenix_fallback_timestamp"
_IS_CONTINUATION_KEY = "_phoenix_is_continuation"
_CONTINUATION_INDEX_KEY = "_phoenix_continuation_index"
_LLM_LATENCY_MS_KEY = "_phoenix_llm_latency_ms"
_LLM_LATENCY_SOURCE_KEY = "_phoenix_llm_latency_source"

_SpanContext = tuple[str, str]
"""``(parent_span_id, trace_id)`` of the span a child trajectory hangs from."""


# --- Identity -----------------------------------------------------------------


@dataclass(frozen=True)
class _TrajectoryIds:
    """Identities derived once per trajectory and shared by every span."""

    session_id: str
    """Phoenix ``session.id``: the run-scoped identity."""
    trace_id: str
    span_seed: str
    """Document-scoped seed for deterministic span IDs."""


def _sha256_span_id(seed: str) -> str:
    return hashlib.sha256(seed.encode()).hexdigest()[:16]


def _sha256_trace_id(seed: str) -> str:
    return hashlib.sha256(seed.encode()).hexdigest()[:32]


def _text(value: object) -> Optional[str]:
    """Return ``value`` when it is a non-blank string."""
    return value if isinstance(value, str) and value.strip() else None


def _schema_minor_version(trajectory: Mapping[str, Any]) -> int:
    """Return the minor ATIF version, or 0 when the version is unreadable."""
    schema_version = trajectory.get("schema_version")
    if not isinstance(schema_version, str) or "-v" not in schema_version:
        return 0
    try:
        return int(schema_version.split("-v", 1)[1].split(".", 1)[1])
    except (IndexError, ValueError):
        return 0


def _document_hash(trajectory: Mapping[str, Any]) -> str:
    """Return a stable identity for a trajectory that declares no usable ID."""
    public = {key: value for key, value in trajectory.items() if not key.startswith("_phoenix_")}
    serialized = json.dumps(public, sort_keys=True, default=str)
    return f"atif-{hashlib.sha256(serialized.encode()).hexdigest()[:16]}"


def _base_session_id(session_id: str) -> str:
    """Strip the ``-cont-N`` suffix Harbor appends to continuation sessions."""
    base, separator, index = session_id.rpartition("-cont-")
    return base if separator and index.isdigit() else session_id


def _session_id(trajectory: Mapping[str, Any], fallback: Optional[str] = None) -> str:
    return (
        _text(trajectory.get("session_id"))
        or fallback
        or _text(trajectory.get("trajectory_id"))
        or _document_hash(trajectory)
    )


def _span_seed(trajectory: Mapping[str, Any], trace_id: Optional[str]) -> str:
    """Return the document-scoped seed for span IDs.

    ATIF v1.7 seeds fall back to a document hash and are qualified by the trace
    so that identical embedded documents under different parents stay distinct.
    Earlier versions keep seeding from ``session_id`` for stable replays.
    """
    trajectory_id = _text(trajectory.get("trajectory_id"))
    if _schema_minor_version(trajectory) < 7:
        return trajectory_id or _session_id(trajectory)
    seed = trajectory_id or _document_hash(trajectory)
    return f"{trace_id}:{seed}" if trace_id else seed


def _trace_seed(trajectory: Mapping[str, Any]) -> str:
    """Return the run-scoped seed for trace IDs.

    Continuations share the base session's trace. A v1.7 standalone document
    that declares neither ``trajectory_id`` nor a continuation is hashed so
    that sibling documents sharing one run session get separate traces.
    """
    session_id = _text(trajectory.get("session_id"))
    if session_id is None:
        return _span_seed(trajectory, None)
    standalone_v17 = (
        _schema_minor_version(trajectory) >= 7
        and "trajectory_id" not in trajectory
        and session_id == _base_session_id(session_id)
        and not trajectory.get("continued_trajectory_ref")
    )
    return _document_hash(trajectory) if standalone_v17 else _base_session_id(session_id)


def _trajectory_ids(
    trajectory: Mapping[str, Any],
    parent_span_context: Optional[_SpanContext],
) -> _TrajectoryIds:
    if parent_span_context is not None:
        trace_id = parent_span_context[1]
    else:
        trace_id = _sha256_trace_id(f"{_trace_seed(trajectory)}:trace")
    return _TrajectoryIds(
        session_id=_session_id(trajectory),
        trace_id=trace_id,
        span_seed=_span_seed(trajectory, trace_id),
    )


def _root_span_id(span_seed: str) -> str:
    return _sha256_span_id(f"{span_seed}:root")


def _step_span_id(span_seed: str, step_id: object) -> str:
    return _sha256_span_id(f"{span_seed}:step:{step_id}:operation")


def _llm_span_id(span_seed: str, step_id: object) -> str:
    return _sha256_span_id(f"{span_seed}:step:{step_id}")


def _tool_span_id(span_seed: str, step_id: object, call_id: object) -> str:
    return _sha256_span_id(f"{span_seed}:step:{step_id}:tool:{call_id}")


# --- Subagent references ------------------------------------------------------


def _trajectory_lookup_keys(trajectory: Mapping[str, Any]) -> List[str]:
    """Return the keys a ref map may use for a trajectory, preferred first."""
    keys = [_text(trajectory.get("trajectory_id")), _text(trajectory.get("session_id"))]
    return [key for key in keys if key]


def _subagent_ref_lookup_keys(
    ref: Mapping[str, Any],
    parent_trajectory: Mapping[str, Any],
) -> List[str]:
    """Return the ref-map keys a subagent ref resolves through.

    ATIF v1.7 resolves refs by ``trajectory_id``. Earlier versions resolved
    them by ``session_id``, so that key is kept for older documents.
    """
    keys = [_text(ref.get("trajectory_id"))]
    if _schema_minor_version(parent_trajectory) < 7:
        keys.append(_text(ref.get("session_id")))
    return [key for key in keys if key]


def _get_parent_span_context(
    trajectory: Mapping[str, Any],
    ref_map: Mapping[str, _SpanContext],
) -> Optional[_SpanContext]:
    """Return the parent span context a subagent ref assigned to a trajectory."""
    embedded = trajectory.get(_PARENT_SPAN_CONTEXT_KEY)
    if isinstance(embedded, tuple) and len(embedded) == 2:
        return embedded
    for key in _trajectory_lookup_keys(trajectory):
        if key in ref_map:
            return ref_map[key]
    return None


def _iter_subagent_refs(
    trajectory: Mapping[str, Any],
) -> Iterator[tuple[Mapping[str, Any], Mapping[str, Any], Mapping[str, Any]]]:
    """Yield ``(step, observation result, ref)`` for refs on fresh steps."""
    for step in trajectory.get("steps", []):
        if step.get("is_copied_context", False):
            continue
        observation = step.get("observation")
        results = observation.get("results") if isinstance(observation, Mapping) else None
        for result in results if isinstance(results, list) else []:
            if not isinstance(result, Mapping):
                continue
            refs = result.get("subagent_trajectory_ref")
            for ref in refs if isinstance(refs, list) else []:
                if isinstance(ref, Mapping):
                    yield step, result, ref


def _subagent_parent_span_id(
    step: Mapping[str, Any],
    result: Mapping[str, Any],
    span_seed: str,
) -> str:
    """Return the closest span the document proves a subagent hangs from.

    A ``source_call_id`` that matches one of the step's tool calls attaches the
    child to that tool span. Otherwise the child attaches to the step span, or
    to the trajectory root when the step is not operational.
    """
    source_call_id = result.get("source_call_id")
    call_ids = {
        tool_call.get("tool_call_id")
        for tool_call in step.get("tool_calls", [])
        if isinstance(tool_call, Mapping)
    }
    step_id = step.get("step_id")
    if isinstance(source_call_id, str) and source_call_id in call_ids:
        return _tool_span_id(span_seed, step_id, source_call_id)
    if _is_operational_step(step):
        return _step_span_id(span_seed, step_id)
    return _root_span_id(span_seed)


def _register_subagent_refs(
    ref_map: Dict[str, _SpanContext],
    trajectory: Mapping[str, Any],
    ids: _TrajectoryIds,
) -> None:
    """Add every subagent ref in ``trajectory`` to ``ref_map``; first ref wins."""
    for step, result, ref in _iter_subagent_refs(trajectory):
        parent_span_id = _subagent_parent_span_id(step, result, ids.span_seed)
        for key in _subagent_ref_lookup_keys(ref, trajectory):
            ref_map.setdefault(key, (parent_span_id, ids.trace_id))


def _build_subagent_ref_map(
    trajectories: Sequence[Mapping[str, Any]],
) -> Dict[str, _SpanContext]:
    """Map child lookup keys to the parent span context their ref names.

    Trajectories are visited in order, so a parent must precede its children
    for cross-document links. Embedded subagents flattened by
    :func:`_flatten_atif_trajectories` already carry their parent context.
    """
    ref_map: Dict[str, _SpanContext] = {}
    for trajectory in trajectories:
        ids = _trajectory_ids(trajectory, _get_parent_span_context(trajectory, ref_map))
        _register_subagent_refs(ref_map, trajectory, ids)
    return ref_map


def _flatten_atif_trajectories(
    trajectories: Sequence[Mapping[str, Any]],
) -> List[Mapping[str, Any]]:
    """Return every trajectory plus its embedded ATIF v1.7 subagents.

    An embedded subagent without a ``session_id`` inherits the nearest parent
    session. Its parent span context is resolved against the containing parent
    only and stored under a Phoenix-private key, so identical child IDs under
    different parents do not collide.
    """
    flattened: List[Mapping[str, Any]] = []

    def visit(
        trajectory: Mapping[str, Any],
        inherited_session_id: Optional[str],
        parent_span_context: Optional[_SpanContext],
    ) -> None:
        document = dict(trajectory)
        if "session_id" not in document and inherited_session_id:
            document["session_id"] = inherited_session_id
        if parent_span_context is not None:
            document[_PARENT_SPAN_CONTEXT_KEY] = parent_span_context
        flattened.append(document)

        children = trajectory.get("subagent_trajectories")
        if not isinstance(children, list):
            return
        local_ref_map: Dict[str, _SpanContext] = {}
        _register_subagent_refs(
            local_ref_map, document, _trajectory_ids(document, parent_span_context)
        )
        session_id = _session_id(trajectory, inherited_session_id)
        for child in children:
            if isinstance(child, Mapping):
                visit(child, session_id, _get_parent_span_context(child, local_ref_map))

    for trajectory in trajectories:
        visit(trajectory, None, None)
    return flattened


# --- Steps --------------------------------------------------------------------


def _context_management(step: Mapping[str, Any]) -> Mapping[str, Any]:
    """Return the step's ``extra.context_management`` block, or an empty map."""
    extra = step.get("extra")
    value = extra.get("context_management") if isinstance(extra, Mapping) else None
    return value if isinstance(value, Mapping) else {}


def _is_compaction_step(step: Mapping[str, Any]) -> bool:
    return bool(_context_management(step))


def _is_operational_step(step: Mapping[str, Any]) -> bool:
    """Return whether a fresh step represents observable execution."""
    return (
        step.get("source") == "agent"
        or bool(step.get("tool_calls"))
        or bool(step.get("observation"))
        or _is_compaction_step(step)
    )


def _has_llm_call(step: Mapping[str, Any]) -> bool:
    """Agent steps call an LLM unless they declare ``llm_call_count: 0``."""
    return step.get("source") == "agent" and step.get("llm_call_count") != 0


def _measured_latency_ms(step: Mapping[str, Any]) -> Optional[float]:
    """Return the adapter-supplied LLM latency, if any."""
    value = step.get(_LLM_LATENCY_MS_KEY)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
        return None
    return float(value)


def _parse_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def _format_timestamp(value: datetime) -> str:
    return value.isoformat()


def _document_start(
    steps: Sequence[Mapping[str, Any]],
    fresh_indices: Sequence[int],
) -> Optional[datetime]:
    """Return the first fresh event, moved back by a measured first LLM latency."""
    for i in fresh_indices:
        timestamp = _parse_timestamp(steps[i].get("timestamp"))
        if timestamp is None:
            continue
        latency_ms = _measured_latency_ms(steps[i]) if _has_llm_call(steps[i]) else None
        return timestamp - timedelta(milliseconds=latency_ms) if latency_ms else timestamp
    return None


def _step_timings(
    steps: Sequence[Mapping[str, Any]],
    fresh_indices: Sequence[int],
    start: datetime,
) -> Dict[int, tuple[datetime, datetime]]:
    """Bound each fresh step by the preceding event and its own timestamp.

    ATIF records when a step happened, not when it began. A missing or
    non-monotonic timestamp collapses onto the preceding event rather than
    inventing elapsed time.
    """
    timings: Dict[int, tuple[datetime, datetime]] = {}
    previous_end = start
    for i in fresh_indices:
        timestamp = _parse_timestamp(steps[i].get("timestamp"))
        end = timestamp if timestamp is not None and timestamp >= previous_end else previous_end
        timings[i] = (previous_end, end)
        previous_end = end
    return timings


def _llm_timing(
    step: Mapping[str, Any],
    step_start: datetime,
    step_end: datetime,
) -> tuple[datetime, datetime, Dict[str, Any]]:
    """Return the LLM interval and its timing metadata.

    A measured latency is clamped to the step interval. Without one, the LLM
    call is a point event at the step timestamp.
    """
    latency_ms = _measured_latency_ms(step)
    if latency_ms is None:
        return step_end, step_end, {"atif.timing": "event"}
    source = step.get(_LLM_LATENCY_SOURCE_KEY)
    source = source if isinstance(source, str) else "adapter"
    measured_end = step_start + timedelta(milliseconds=latency_ms)
    if measured_end > step_end:
        source = f"{source}_clamped"
        measured_end = step_end
    return step_start, measured_end, {"atif.timing": source, "atif.measured_latency_ms": latency_ms}


def _split_into_turns(
    steps: Sequence[Mapping[str, Any]],
    fresh_indices: Sequence[int],
) -> List[List[int]]:
    """Group fresh step indices into turns.

    A turn is one user request plus the activity that answers it. A user
    message opens a new turn only after agent activity, so leading system
    steps and consecutive context messages stay in the turn they introduce.
    """
    turns: List[List[int]] = []
    current: List[int] = []
    has_agent_activity = False
    for i in fresh_indices:
        source = steps[i].get("source")
        if source == "user" and has_agent_activity:
            turns.append(current)
            current, has_agent_activity = [], False
        current.append(i)
        has_agent_activity = has_agent_activity or source == "agent"
    if current:
        turns.append(current)
    return turns


def _step_names(
    steps: Sequence[Mapping[str, Any]],
    fresh_indices: Sequence[int],
) -> Dict[int, str]:
    """Name operational steps with per-label ordinals (``iteration 3``).

    An agent step is one iteration of the agent loop. A compaction step and
    an operational system step (a handoff, for example) are labeled by what
    they are; the ordinal counts steps with the same label.
    """
    ordinals: Dict[str, int] = {}
    names: Dict[int, str] = {}
    for i in fresh_indices:
        step = steps[i]
        if not _is_operational_step(step):
            continue
        if _is_compaction_step(step):
            label = "compaction"
        elif step.get("source") == "agent":
            label = "iteration"
        else:
            label = f"{step.get('source', 'unknown')} event"
        ordinals[label] = ordinals.get(label, 0) + 1
        names[i] = f"{label} {ordinals[label]}"
    return names


def _pair_observations(
    step: Mapping[str, Any],
) -> tuple[Dict[str, Mapping[str, Any]], List[Mapping[str, Any]]]:
    """Split observation results into those matched to a tool call and the rest.

    A result names its tool call through ``source_call_id``. When the step has
    exactly one tool call and exactly one unmatched result, they are paired.
    """
    tool_calls = [call for call in step.get("tool_calls", []) if isinstance(call, Mapping)]
    call_ids = {call.get("tool_call_id") for call in tool_calls if call.get("tool_call_id")}
    observation = step.get("observation") or {}
    matched: Dict[str, Mapping[str, Any]] = {}
    unmatched: List[Mapping[str, Any]] = []
    for result in observation.get("results", []):
        if not isinstance(result, Mapping):
            continue
        source_call_id = result.get("source_call_id")
        if isinstance(source_call_id, str) and source_call_id in call_ids:
            matched[source_call_id] = result
        elif result.get("content") is not None:
            unmatched.append(result)
    if len(tool_calls) == 1 and len(unmatched) == 1:
        only_call_id = str(tool_calls[0].get("tool_call_id", "tc_0"))
        if only_call_id not in matched:
            matched[only_call_id] = unmatched.pop()
    return matched, unmatched


# --- Messages -----------------------------------------------------------------


def _stringify_message(message: Union[str, list[Any], None]) -> str:
    """Flatten a string or multimodal ``list[ContentPart]`` message to text."""
    if message is None:
        return ""
    if isinstance(message, str):
        return message
    parts: list[str] = []
    for part in message:
        if isinstance(part, str):
            parts.append(part)
        elif isinstance(part, dict):
            text: object = part.get("text")
            if text:
                parts.append(str(text))
            elif part.get("type") == "image" and isinstance(part.get("source"), dict):
                parts.append(f"[image: {part['source'].get('path', 'unknown')}]")
    return "\n".join(parts)


def _stringify_content(content: Union[str, list[Any], None]) -> Optional[str]:
    return None if content is None else _stringify_message(content)


def _stringify_observation_results(results: Sequence[Any]) -> str:
    parts = [
        content
        for result in results
        if isinstance(result, dict)
        for content in [_stringify_content(result.get("content"))]
        if content
    ]
    return "\n".join(parts)


def _has_multimodal_content(message: Union[str, list[Any], None]) -> bool:
    if not isinstance(message, list):
        return False
    return any(isinstance(part, dict) and part.get("type") != "text" for part in message)


def _build_content_part_attributes(prefix: str, parts: list[Any]) -> Dict[str, Any]:
    """Write multimodal parts as OpenInference ``message.contents`` attributes."""
    attrs: Dict[str, Any] = {}
    for j, part in enumerate(parts):
        key = f"{prefix}.message.contents.{j}.message_content"
        if isinstance(part, str):
            attrs[f"{key}.type"] = "text"
            attrs[f"{key}.text"] = part
        elif isinstance(part, dict):
            part_type = part.get("type", "text")
            attrs[f"{key}.type"] = part_type
            if part_type == "text" and part.get("text"):
                attrs[f"{key}.text"] = str(part["text"])
            elif part_type == "image" and isinstance(part.get("source"), dict):
                path = part["source"].get("path", "")
                if path:
                    attrs[f"{key}.image.image.url"] = path
    return attrs


def _tool_call_message(tool_call: Mapping[str, Any]) -> Dict[str, Any]:
    """Return an OpenAI-style tool call entry for an assistant message."""
    function: Dict[str, Any] = {"name": tool_call.get("function_name", "")}
    if tool_call.get("arguments") is not None:
        function["arguments"] = json.dumps(tool_call["arguments"])
    entry: Dict[str, Any] = {"function": function}
    if tool_call.get("tool_call_id"):
        entry["id"] = tool_call["tool_call_id"]
    return entry


def _chat_message(role: str, raw_message: Any) -> Dict[str, Any]:
    message: Dict[str, Any] = {"role": role}
    text = _stringify_message(raw_message)
    if text:
        message["content"] = text
    if isinstance(raw_message, list):
        message["_raw_parts"] = raw_message
    return message


def _assistant_message(step: Mapping[str, Any]) -> Dict[str, Any]:
    message = _chat_message("assistant", step.get("message"))
    tool_calls = step.get("tool_calls") or []
    if tool_calls:
        message["tool_calls"] = [_tool_call_message(call) for call in tool_calls]
    return message


def _messages_from_step(step: Mapping[str, Any]) -> List[Dict[str, Any]]:
    """Return the chat messages one earlier step contributes to a prompt."""
    source = step.get("source")
    if source in ("user", "system"):
        message = _chat_message(str(source), step.get("message"))
        return [message] if "content" in message else []
    if source != "agent":
        return []
    assistant = _assistant_message(step)
    tool_calls = step.get("tool_calls") or []
    if not tool_calls or not step.get("observation"):
        return [assistant]
    contents = {
        result["source_call_id"]: content
        for result in step["observation"].get("results", [])
        if isinstance(result, dict) and isinstance(result.get("source_call_id"), str)
        for content in [_stringify_content(result.get("content"))]
        if content is not None
    }
    tool_messages = [
        {
            "role": "tool",
            "content": contents.get(call.get("tool_call_id", ""), ""),
            "tool_call_id": call.get("tool_call_id", ""),
        }
        for call in tool_calls
    ]
    return [assistant, *tool_messages]


def _context_window(
    steps: Sequence[Mapping[str, Any]],
    step_index: int,
) -> tuple[int, Optional[str]]:
    """Return the first step still in context and the summary that replaced history.

    A step whose ``context_management.boundary`` is ``replace`` (ATIF v1.7)
    drops everything before it from the prompt and substitutes its observation.
    """
    start, replacement = 0, None
    for i in range(step_index):
        if _context_management(steps[i]).get("boundary") != "replace":
            continue
        observation = steps[i].get("observation")
        results = observation.get("results", []) if isinstance(observation, dict) else []
        replacement = _stringify_observation_results(results)
        start = i + 1
    return start, replacement


def _prompt_messages(
    steps: Sequence[Mapping[str, Any]],
    step_index: int,
) -> List[Dict[str, Any]]:
    """Reconstruct the conversation an LLM step most likely received.

    The real prompt may differ when the producer used a sliding window or
    summarization that ATIF does not record.
    """
    start, replacement = _context_window(steps, step_index)
    messages: List[Dict[str, Any]] = []
    if replacement is not None:
        messages.append({"role": "system", "content": replacement})
    for step in steps[start:step_index]:
        messages.extend(_messages_from_step(step))
    return messages


def _message_attributes(prefix: str, message: Mapping[str, Any]) -> Dict[str, Any]:
    """Flatten one chat message into OpenInference message attributes."""
    attrs: Dict[str, Any] = {f"{prefix}.message.role": message["role"]}
    if "_raw_parts" in message:
        attrs.update(_build_content_part_attributes(prefix, message["_raw_parts"]))
    elif "content" in message:
        attrs[f"{prefix}.message.content"] = message["content"]
    if "tool_call_id" in message:
        attrs[f"{prefix}.message.tool_call_id"] = message["tool_call_id"]
    for index, tool_call in enumerate(message.get("tool_calls", [])):
        key = f"{prefix}.message.tool_calls.{index}.tool_call"
        if "id" in tool_call:
            attrs[f"{key}.id"] = tool_call["id"]
        attrs[f"{key}.function.name"] = tool_call["function"]["name"]
        if "arguments" in tool_call["function"]:
            attrs[f"{key}.function.arguments"] = tool_call["function"]["arguments"]
    return attrs


def _serialize_messages(messages: Sequence[Mapping[str, Any]]) -> str:
    """Serialize prompt messages, exposing raw multimodal parts as ``content``."""
    serialized = [
        {("content" if key == "_raw_parts" else key): value for key, value in message.items()}
        for message in messages
    ]
    return json.dumps(serialized)


def _build_message_attributes(
    steps: Sequence[Mapping[str, Any]],
    step_index: int,
) -> Dict[str, Any]:
    """Build ``llm.input_messages``, ``llm.output_messages``, and ``input.value``."""
    attrs: Dict[str, Any] = {}
    prompt = _prompt_messages(steps, step_index)
    for index, message in enumerate(prompt):
        attrs.update(_message_attributes(f"llm.input_messages.{index}", message))
    if prompt:
        attrs["input.value"] = _serialize_messages(prompt)
        attrs["input.mime_type"] = "application/json"
    output = _assistant_message(steps[step_index])
    if "content" in output or "tool_calls" in output:
        attrs.update(_message_attributes("llm.output_messages.0", output))
    return attrs


# --- Attributes ---------------------------------------------------------------


def _update_metadata(attributes: Dict[str, Any], values: Mapping[str, Any]) -> None:
    """Merge values into ``attributes["metadata"]`` without replacing it."""
    metadata = attributes.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
        attributes["metadata"] = metadata
    metadata.update(values)


def _io_attributes(
    input_value: Optional[str] = None,
    output_value: Optional[str] = None,
    *,
    output_mime_type: str = "text/plain",
) -> Dict[str, Any]:
    attrs: Dict[str, Any] = {}
    if input_value is not None:
        attrs["input.value"] = input_value
        attrs["input.mime_type"] = "text/plain"
    if output_value is not None:
        attrs["output.value"] = output_value
        attrs["output.mime_type"] = output_mime_type
    return attrs


def _build_llm_attributes(step: Mapping[str, Any], agent: Mapping[str, Any]) -> Dict[str, Any]:
    """Build OpenInference LLM attributes from an agent step."""
    attrs: Dict[str, Any] = {}
    model_name = step.get("model_name") or agent.get("model_name")
    if model_name:
        attrs["llm.model_name"] = model_name
    attrs.update(_io_attributes(output_value=_stringify_message(step.get("message")) or None))

    metrics: Mapping[str, Any] = step.get("metrics") or {}
    prompt_tokens = metrics.get("prompt_tokens")
    completion_tokens = metrics.get("completion_tokens")
    if prompt_tokens is not None:
        attrs["llm.token_count.prompt"] = prompt_tokens
    if completion_tokens is not None:
        attrs["llm.token_count.completion"] = completion_tokens
    if prompt_tokens or completion_tokens:
        attrs["llm.token_count.total"] = int(prompt_tokens or 0) + int(completion_tokens or 0)
    if metrics.get("cached_tokens") is not None:
        attrs["llm.token_count.prompt_details.cache_read"] = metrics["cached_tokens"]
    if metrics.get("cost_usd") is not None:
        attrs["llm.cost.total"] = metrics["cost_usd"]

    metadata: Dict[str, Any] = {}
    if step.get("reasoning_content"):
        metadata["reasoning_content"] = step["reasoning_content"]
    if step.get("llm_call_count") is not None:
        metadata["llm_call_count"] = step["llm_call_count"]
    if _has_multimodal_content(step.get("message")):
        metadata["has_multimodal_content"] = True
    if metadata:
        attrs["metadata"] = metadata
    return attrs


def _build_tool_attributes(
    tool_call: Mapping[str, Any],
    observation_content: Optional[str],
    observation_result: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Build OpenInference TOOL attributes from a tool call and its result."""
    attrs: Dict[str, Any] = {"tool.name": tool_call.get("function_name") or "unknown"}
    if tool_call.get("arguments") is not None:
        attrs["input.value"] = json.dumps(tool_call["arguments"])
        attrs["input.mime_type"] = "application/json"
    attrs.update(_io_attributes(output_value=observation_content))

    metadata: Dict[str, Any] = {}
    if tool_call.get("extra") is not None:
        metadata["tool_call_extra"] = tool_call["extra"]
    if observation_result is not None and observation_result.get("extra") is not None:
        metadata["observation_extra"] = observation_result["extra"]
    if metadata:
        attrs["metadata"] = metadata
    return attrs


def _build_llm_tools_attributes(tool_definitions: Sequence[Mapping[str, Any]]) -> Dict[str, str]:
    return {
        f"llm.tools.{index}.tool.json_schema": json.dumps(definition)
        for index, definition in enumerate(tool_definitions)
    }


def _user_messages(steps: Sequence[Mapping[str, Any]], *, stop_at_agent: bool) -> Iterator[str]:
    """Yield non-empty user messages, optionally stopping at the first fresh agent step."""
    for step in steps:
        fresh = not step.get("is_copied_context", False)
        if stop_at_agent and fresh and step.get("source") == "agent":
            return
        if step.get("source") == "user":
            message = _stringify_message(step.get("message"))
            if message:
                yield message


def _get_trajectory_input(steps: Sequence[Mapping[str, Any]]) -> str:
    """Return the user request that the trajectory answers.

    Some producers record environment context as extra leading user steps, so
    the request is the last fresh user message before the first fresh agent
    step. A continuation document may carry its whole prompt as copied
    context, so copied user messages are the final fallback.
    """
    fresh = [step for step in steps if not step.get("is_copied_context", False)]
    before_agent = list(_user_messages(fresh, stop_at_agent=True))
    if before_agent:
        return before_agent[-1]
    anywhere = next(_user_messages(fresh, stop_at_agent=False), "")
    if anywhere:
        return anywhere
    copied = list(_user_messages(steps, stop_at_agent=True))
    return copied[-1] if copied else ""


def _get_trajectory_output(steps: Sequence[Mapping[str, Any]]) -> str:
    """Return the last fresh agent message."""
    for step in reversed(steps):
        if step.get("source") == "agent" and not step.get("is_copied_context", False):
            return _stringify_message(step.get("message"))
    return ""


def _get_turn_input(steps: Sequence[Mapping[str, Any]], step_indices: Sequence[int]) -> str:
    """Return the user message that opens a turn, or its first message."""
    for i in step_indices:
        if steps[i].get("source") == "user":
            return _stringify_message(steps[i].get("message"))
    return next((_stringify_message(steps[i].get("message")) for i in step_indices), "")


def _get_turn_output(steps: Sequence[Mapping[str, Any]], step_indices: Sequence[int]) -> str:
    """Return the last agent message in a turn."""
    for i in reversed(step_indices):
        if steps[i].get("source") == "agent":
            return _stringify_message(steps[i].get("message"))
    return ""


def _step_input(
    steps: Sequence[Mapping[str, Any]],
    fresh_indices: Sequence[int],
    step_index: int,
) -> Optional[str]:
    """Return what the agent received just before a step.

    That is the preceding fresh step's message for user and system steps, or
    its observations for an agent step.
    """
    for i in reversed([i for i in fresh_indices if i < step_index]):
        previous = steps[i]
        if previous.get("source") == "agent":
            observation = previous.get("observation") or {}
            text = _stringify_observation_results(observation.get("results", []))
        else:
            text = _stringify_message(previous.get("message"))
        if text:
            return text
    return None


# --- Spans --------------------------------------------------------------------


@dataclass(frozen=True)
class _Document:
    """A trajectory plus the values every span derives from it."""

    trajectory: Mapping[str, Any]
    ids: _TrajectoryIds
    parent_span_id: Optional[str]
    fresh_indices: List[int]
    start: datetime
    timings: Dict[int, tuple[datetime, datetime]]
    llm_tool_attrs: Dict[str, str]

    @property
    def steps(self) -> Sequence[Mapping[str, Any]]:
        return cast(Sequence[Mapping[str, Any]], self.trajectory["steps"])

    @property
    def agent(self) -> Mapping[str, Any]:
        return cast(Mapping[str, Any], self.trajectory["agent"])

    @property
    def end(self) -> datetime:
        return self.timings[self.fresh_indices[-1]][1] if self.fresh_indices else self.start

    @property
    def root_span_id(self) -> str:
        return _root_span_id(self.ids.span_seed)

    def span(
        self,
        *,
        name: str,
        span_id: str,
        kind: str,
        parent_id: Optional[str],
        start: datetime,
        end: datetime,
        attributes: Mapping[str, Any],
    ) -> v1.Span:
        span_attributes: Dict[str, Any] = {
            "openinference.span.kind": kind,
            "session.id": self.ids.session_id,
            **attributes,
        }
        _update_metadata(span_attributes, {"agent_name": self.agent.get("name")})
        span: v1.Span = {
            "name": name,
            "context": {"trace_id": self.ids.trace_id, "span_id": span_id},
            "span_kind": kind,
            "start_time": _format_timestamp(start),
            "end_time": _format_timestamp(end),
            "status_code": "OK",
            "attributes": span_attributes,
        }
        if parent_id is not None:
            span["parent_id"] = parent_id
        return span


def _prepare_document(
    trajectory: Mapping[str, Any],
    parent_span_context: Optional[_SpanContext],
) -> _Document:
    steps: Sequence[Mapping[str, Any]] = trajectory["steps"]
    fresh_indices = [i for i, step in enumerate(steps) if not step.get("is_copied_context", False)]
    start = _document_start(steps, fresh_indices) or _parse_timestamp(
        trajectory.get(_FALLBACK_TIMESTAMP_KEY)
    )
    if start is None:
        start = datetime.now(tz=timezone.utc)
    tool_definitions = trajectory["agent"].get("tool_definitions") or []
    return _Document(
        trajectory=trajectory,
        ids=_trajectory_ids(trajectory, parent_span_context),
        parent_span_id=parent_span_context[0] if parent_span_context else None,
        fresh_indices=fresh_indices,
        start=start,
        timings=_step_timings(steps, fresh_indices, start),
        llm_tool_attrs=_build_llm_tools_attributes(tool_definitions),
    )


def _root_name_and_metadata(doc: _Document) -> tuple[str, Dict[str, Any]]:
    """Return the root span name and the agent metadata it carries."""
    trajectory, agent = doc.trajectory, doc.agent
    metadata: Dict[str, Any] = {"agent_version": agent.get("version")}
    if _text(trajectory.get("trajectory_id")):
        metadata["trajectory_id"] = trajectory["trajectory_id"]
    if agent.get("model_name"):
        metadata["model_name"] = agent["model_name"]
    metadata.update(agent.get("extra") or {})
    if trajectory.get("final_metrics"):
        metadata["final_metrics"] = trajectory["final_metrics"]

    name = str(agent.get("name") or "agent")
    session_id = trajectory.get("session_id")
    is_continuation = bool(trajectory.get(_IS_CONTINUATION_KEY)) or (
        isinstance(session_id, str) and session_id != _base_session_id(session_id)
    )
    if is_continuation:
        metadata["is_continuation"] = True
        index = trajectory.get(_CONTINUATION_INDEX_KEY)
        if isinstance(index, int) and index > 0:
            metadata["continuation_index"] = index
            name = f"{name} (continuation {index})"
        else:
            name = f"{name} (continuation)"
    return name, metadata


def _root_span(doc: _Document) -> v1.Span:
    name, metadata = _root_name_and_metadata(doc)
    return doc.span(
        name=name,
        span_id=doc.root_span_id,
        kind="AGENT",
        parent_id=doc.parent_span_id,
        start=doc.start,
        end=doc.end,
        attributes={
            **_io_attributes(_get_trajectory_input(doc.steps), _get_trajectory_output(doc.steps)),
            "metadata": metadata,
        },
    )


def _turn_span(doc: _Document, turn_index: int, step_indices: Sequence[int]) -> v1.Span:
    return doc.span(
        name=f"turn {turn_index + 1}",
        span_id=_sha256_span_id(f"{doc.ids.span_seed}:turn:{turn_index}"),
        kind="AGENT",
        parent_id=doc.root_span_id,
        start=doc.timings[step_indices[0]][1],
        end=doc.timings[step_indices[-1]][1],
        attributes=_io_attributes(
            _get_turn_input(doc.steps, step_indices),
            _get_turn_output(doc.steps, step_indices),
        ),
    )


def _step_io_attributes(
    doc: _Document,
    step_index: int,
    unmatched_results: Sequence[Mapping[str, Any]],
) -> Dict[str, Any]:
    """Return input and output for a step span.

    An agent step receives the preceding context and produces its message plus
    any observation that no tool call claims; a step that only issued tool
    calls reports their results. A system step's own message is its input.
    """
    step = doc.steps[step_index]
    message = _stringify_message(step.get("message")) or None
    observation = _stringify_observation_results(unmatched_results) or None
    if step.get("source") != "agent":
        return _io_attributes(message, observation)
    if message is None and observation is None:
        results = (step.get("observation") or {}).get("results", [])
        observation = _stringify_observation_results(results) or None
    input_value = _step_input(doc.steps, doc.fresh_indices, step_index)
    if message and observation:
        return _io_attributes(
            input_value,
            json.dumps({"message": message, "observation": observation}),
            output_mime_type="application/json",
        )
    return _io_attributes(input_value, message or observation)


def _step_span(
    doc: _Document,
    step_index: int,
    name: str,
    parent_id: str,
    unmatched_results: Sequence[Mapping[str, Any]],
) -> v1.Span:
    step = doc.steps[step_index]
    step_id = step.get("step_id", step_index + 1)
    metadata: Dict[str, Any] = {
        "atif.step_id": step_id,
        "atif.source": str(step.get("source", "unknown")),
        "atif.timing": "event_interval",
    }
    if _is_compaction_step(step):
        metadata["atif.context_management"] = True
    start, end = doc.timings[step_index]
    return doc.span(
        name=name,
        span_id=_step_span_id(doc.ids.span_seed, step_id),
        kind="CHAIN",
        parent_id=parent_id,
        start=start,
        end=end,
        attributes={
            **_step_io_attributes(doc, step_index, unmatched_results),
            "metadata": metadata,
        },
    )


def _llm_span(doc: _Document, step_index: int, parent_id: str) -> v1.Span:
    step = doc.steps[step_index]
    step_id = step.get("step_id", step_index + 1)
    start, end, timing_metadata = _llm_timing(step, *doc.timings[step_index])
    attrs = _build_llm_attributes(step, doc.agent)
    attrs.update(_build_message_attributes(doc.steps, step_index))
    attrs.update(doc.llm_tool_attrs)
    if any(doc.steps[i].get("is_copied_context") for i in range(step_index)):
        _update_metadata(attrs, {"has_copied_context": True})
    _update_metadata(attrs, {"atif.step_id": step_id, **timing_metadata})
    model_name = attrs.get("llm.model_name")
    return doc.span(
        name=str(model_name) if model_name else "LLM",
        span_id=_llm_span_id(doc.ids.span_seed, step_id),
        kind="LLM",
        parent_id=parent_id,
        start=start,
        end=end,
        attributes=attrs,
    )


def _tool_span(
    doc: _Document,
    step_index: int,
    call_index: int,
    tool_call: Mapping[str, Any],
    result: Optional[Mapping[str, Any]],
    parent_id: str,
) -> v1.Span:
    step = doc.steps[step_index]
    step_id = step.get("step_id", step_index + 1)
    call_id = tool_call.get("tool_call_id", f"tc_{call_index}")
    content = _stringify_content(result.get("content")) if result is not None else None
    attrs = _build_tool_attributes(tool_call, content, result)
    metadata: Dict[str, Any] = {}
    if step.get("llm_call_count") == 0:
        metadata["llm_call_count"] = 0
    metadata.update(
        {"atif.step_id": step_id, "atif.tool_call_index": call_index, "atif.timing": "event"}
    )
    _update_metadata(attrs, metadata)
    event_time = doc.timings[step_index][1]
    return doc.span(
        name=str(attrs["tool.name"]),
        span_id=_tool_span_id(doc.ids.span_seed, step_id, call_id),
        kind="TOOL",
        parent_id=parent_id,
        start=event_time,
        end=event_time,
        attributes=attrs,
    )


def _step_spans(doc: _Document, step_index: int, name: str, parent_id: str) -> List[v1.Span]:
    """Return the CHAIN span for a step and its LLM and TOOL children."""
    step = doc.steps[step_index]
    matched, unmatched = _pair_observations(step)
    chain = _step_span(doc, step_index, name, parent_id, unmatched)
    chain_id = chain["context"]["span_id"]
    spans = [chain]
    if _has_llm_call(step):
        spans.append(_llm_span(doc, step_index, chain_id))
    for call_index, tool_call in enumerate(step.get("tool_calls", [])):
        call_id = tool_call.get("tool_call_id", f"tc_{call_index}")
        spans.append(
            _tool_span(doc, step_index, call_index, tool_call, matched.get(call_id), chain_id)
        )
    return spans


def _convert_atif_trajectory_to_spans(
    trajectory: Mapping[str, Any],
    parent_span_context: Optional[_SpanContext] = None,
) -> List[v1.Span]:
    """Convert a validated ATIF trajectory into a flat list of spans.

    Single-turn trajectories place each step under the root; multi-turn
    trajectories add one AGENT span per turn::

        AGENT <agent name>
          AGENT turn 1                 (multi-turn only)
            CHAIN iteration 1
              LLM <model name>
              TOOL <tool name>
            CHAIN iteration 2
              LLM <model name>

    Copied-context steps contribute to reconstructed prompts only. IDs are
    deterministic, so converting the same trajectory twice yields the same
    trace.

    Args:
        trajectory: A validated ATIF trajectory.
        parent_span_context: ``(parent_span_id, trace_id)`` when a subagent ref
            links this trajectory beneath another trajectory's span.
    """
    doc = _prepare_document(trajectory, parent_span_context)
    names = _step_names(doc.steps, doc.fresh_indices)
    turns = _split_into_turns(doc.steps, doc.fresh_indices)
    spans = [_root_span(doc)]
    for turn_index, step_indices in enumerate(turns):
        parent_id = doc.root_span_id
        if len(turns) > 1:
            turn = _turn_span(doc, turn_index, step_indices)
            spans.append(turn)
            parent_id = turn["context"]["span_id"]
        for step_index in step_indices:
            if step_index in names:
                spans.extend(_step_spans(doc, step_index, names[step_index], parent_id))
    return spans
