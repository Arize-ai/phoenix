"""Conversation reconstruction from an ingested PXI turn trace.

The *last* top-level ``LLM`` span in a ``pxi.turn`` trace carries the full
input message history (all prior turns in the session and all preceding model
and tool activity, as the agent saw them) plus the final assistant output.
Earlier top-level LLM spans are therefore intermediate snapshots, not missing
conversation data that needs to be merged. A single trace reconstructs the
entire user-facing transcript — no session-level fetching is required. We
then segment that transcript into turns (split on ``user`` messages).

The Phoenix REST API returns span attributes fully flattened with dotted,
index-numbered keys, e.g.::

    llm.input_messages.2.message.role
    llm.input_messages.2.message.tool_calls.0.tool_call.function.name

We unflatten them with the same :func:`phoenix.trace.attributes.unflatten`
helper the ingestion path uses, then normalize into :class:`Message` objects.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from phoenix.client.__generated__ import v1

from phoenix.trace.attributes import get_attribute_value, unflatten

logger = logging.getLogger(__name__)

INPUT_MESSAGES_KEY = "llm.input_messages"
OUTPUT_MESSAGES_KEY = "llm.output_messages"


@dataclass
class Message:
    """A normalized chat message."""

    role: str
    content: str
    tool_calls: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class Turn:
    """One user turn and the assistant work it triggered.

    ``messages`` is the slice of the transcript belonging to this turn,
    starting with the ``user`` message. ``tool_calls`` is every tool call
    flattened from the assistant messages in this turn.
    """

    user_message: str
    messages: list[Message]
    tool_calls: list[dict[str, Any]]
    index: int


def _parse_tool_args(args: Any) -> Any:
    if isinstance(args, str):
        try:
            return json.loads(args)
        except (json.JSONDecodeError, ValueError):
            return args
    return args


def _normalize_tool_calls(raw: Any) -> list[dict[str, Any]]:
    """Normalize an unflattened tool-call list to ``{id, name, args}`` dicts."""
    if not isinstance(raw, list):
        return []
    calls: list[dict[str, Any]] = []
    for entry in raw:
        call = entry.get("tool_call") if isinstance(entry, dict) else None
        if not isinstance(call, dict):
            continue
        function = call.get("function")
        function = function if isinstance(function, dict) else {}
        calls.append(
            {
                "id": call.get("id"),
                "name": function.get("name"),
                "args": _parse_tool_args(function.get("arguments")),
            }
        )
    return calls


def _normalize_message(raw: dict[str, Any]) -> Message:
    """Normalize one unflattened OpenInference message dict to a :class:`Message`."""
    role = str(raw.get("role") or "")
    content = raw.get("content")
    if not isinstance(content, str):
        content = "" if content is None else json.dumps(content, default=str)
    if not content and isinstance(raw.get("contents"), list):
        parts = [
            text
            for part in raw["contents"]
            if isinstance(part, dict)
            and isinstance(text := get_attribute_value(part, "message_content.text"), str)
        ]
        content = "\n".join(parts)
    return Message(
        role=role,
        content=content,
        tool_calls=_normalize_tool_calls(raw.get("tool_calls")),
    )


def messages_from_attributes(
    attributes: dict[str, Any], key: str = INPUT_MESSAGES_KEY
) -> list[Message]:
    """Unflatten dotted, index-numbered message attributes into messages."""
    value = get_attribute_value(unflatten(attributes.items()), key)
    if not isinstance(value, list):
        return []
    return [
        _normalize_message(message)
        for entry in value
        if isinstance(entry, dict) and isinstance(message := entry.get("message"), dict)
    ]


def _last_llm_span(spans: Sequence[v1.Span]) -> v1.Span | None:
    """The trace's final top-level ``LLM`` span.

    Intermediate main-agent LLM calls are cumulative snapshots; only the last
    one's input is needed. Subagents (e.g. ``call_subagent``) nest their own
    LLM spans inside the same trace, and one of those can start after the main
    agent's final call — picking it would reconstruct the subagent's internal
    conversation instead of the user-facing transcript. Prefer LLM spans that
    are direct children of the trace root; fall back to all LLM spans only when
    none are.
    Ties on ``start_time`` keep the later span (stable sort).
    """
    llm_spans = [span for span in spans if span.get("span_kind") == "LLM"]
    if not llm_spans:
        return None
    root_ids = {span["context"]["span_id"] for span in spans if span.get("parent_id") in (None, "")}
    top_level = [span for span in llm_spans if span.get("parent_id") in root_ids]
    candidates = top_level or llm_spans
    return sorted(candidates, key=lambda span: span["start_time"])[-1]


def transcript(spans: Sequence[v1.Span]) -> list[Message]:
    """Reconstruct the full message transcript from a turn's trace spans.

    Uses the last top-level ``LLM`` span: its ``input_messages`` are the
    history fed to the model, and its ``output_messages`` are the final
    assistant reply we append. Returns an empty list if the trace has no
    LLM span.
    """
    last_llm = _last_llm_span(spans)
    if last_llm is None:
        logger.warning("Trace has no LLM span; cannot reconstruct transcript")
        return []
    attributes = dict(last_llm.get("attributes", {}))
    return messages_from_attributes(attributes, INPUT_MESSAGES_KEY) + messages_from_attributes(
        attributes, OUTPUT_MESSAGES_KEY
    )


def segment_turns(transcript_messages: list[Message]) -> list[Turn]:
    """Split a transcript into turns on each ``user`` message.

    Messages before the first ``user`` message (e.g. the ``system`` prompt) are
    discarded. Each turn's ``tool_calls`` is the flattened list of tool calls
    across its assistant messages.
    """
    turns: list[Turn] = []
    current: list[Message] = []

    def _flush() -> None:
        if not current:
            return
        tool_calls: list[dict[str, Any]] = []
        for msg in current:
            if msg.role == "assistant":
                tool_calls.extend(msg.tool_calls)
        turns.append(
            Turn(
                user_message=current[0].content,
                messages=list(current),
                tool_calls=tool_calls,
                index=len(turns),
            )
        )

    for msg in transcript_messages:
        if msg.role == "user":
            _flush()
            current = [msg]
        elif current:
            current.append(msg)
        # else: pre-first-user messages (system) are dropped.
    _flush()
    return turns


__all__ = ["Message", "Turn", "messages_from_attributes", "segment_turns", "transcript"]
