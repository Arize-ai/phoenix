"""Conversation reconstruction from an ingested PXI turn trace.

The *last* ``LLM`` span in a ``pxi.turn`` trace carries the full input message
history (all prior turns in the session, as the agent saw them) plus the final
assistant output, so a single trace reconstructs the entire transcript — no
session-level fetching is required. We then segment that transcript into turns
(split on ``user`` messages).

The Phoenix REST API returns span attributes fully flattened with dotted,
index-numbered keys, e.g.::

    llm.input_messages.2.message.role
    llm.input_messages.2.message.tool_calls.0.tool_call.function.name

This module unflattens those keys back into normalized :class:`Message`
objects. It is a port of the validated ``user-friction-eval`` pipeline's
``conversation.py`` (which operated on pandas DataFrames) onto raw
``v1.Span`` dicts.
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from phoenix.client.__generated__ import v1

logger = logging.getLogger(__name__)

INPUT_MESSAGES_PREFIX = "llm.input_messages"
OUTPUT_MESSAGES_PREFIX = "llm.output_messages"

_MESSAGE_KEY = re.compile(r"^(?P<index>\d+)\.message\.(?P<rest>.+)$")
_TOOL_CALL_KEY = re.compile(r"^tool_calls\.(?P<index>\d+)\.tool_call\.(?P<rest>.+)$")
_CONTENTS_TEXT_KEY = re.compile(r"^contents\.(?P<index>\d+)\.message_content\.text$")


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


def _normalize_message(raw: dict[str, Any]) -> Message:
    """Normalize one unflattened message dict to a :class:`Message`."""
    role = str(raw.get("role") or "")
    content = raw.get("content")
    if not isinstance(content, str):
        content = "" if content is None else json.dumps(content, default=str)
    if not content and raw.get("contents"):
        parts = raw["contents"]
        content = "\n".join(parts[key] for key in sorted(parts) if isinstance(parts[key], str))
    tool_calls = [
        {
            "id": call.get("id"),
            "name": call.get("function.name"),
            "args": _parse_tool_args(call.get("function.arguments")),
        }
        for _, call in sorted(raw.get("tool_calls", {}).items())
    ]
    return Message(role=role, content=content, tool_calls=tool_calls)


def messages_from_attributes(
    attributes: Mapping[str, Any], prefix: str = INPUT_MESSAGES_PREFIX
) -> list[Message]:
    """Unflatten dotted, index-numbered message attributes into messages."""
    collected: dict[int, dict[str, Any]] = {}
    marker = prefix + "."
    for key, value in attributes.items():
        if not key.startswith(marker):
            continue
        match = _MESSAGE_KEY.match(key[len(marker) :])
        if match is None:
            continue
        message = collected.setdefault(int(match["index"]), {})
        rest = match["rest"]
        tool_call = _TOOL_CALL_KEY.match(rest)
        if tool_call is not None:
            calls = message.setdefault("tool_calls", {})
            calls.setdefault(int(tool_call["index"]), {})[tool_call["rest"]] = value
            continue
        contents = _CONTENTS_TEXT_KEY.match(rest)
        if contents is not None:
            message.setdefault("contents", {})[int(contents["index"])] = value
            continue
        message[rest] = value
    return [_normalize_message(collected[index]) for index in sorted(collected)]


def _last_llm_span(spans: Sequence[v1.Span]) -> v1.Span | None:
    llm_spans = [span for span in spans if span.get("span_kind") == "LLM"]
    if not llm_spans:
        return None
    return max(llm_spans, key=lambda span: span["start_time"])


def transcript(spans: Sequence[v1.Span]) -> list[Message]:
    """Reconstruct the full message transcript from a turn's trace spans.

    Uses the last ``LLM`` span: its ``input_messages`` are the history fed to
    the model, and its ``output_messages`` are the final assistant reply we
    append. Returns an empty list if the trace has no LLM span.
    """
    last_llm = _last_llm_span(spans)
    if last_llm is None:
        logger.warning("Trace has no LLM span; cannot reconstruct transcript")
        return []
    attributes = last_llm.get("attributes", {})
    return messages_from_attributes(attributes, INPUT_MESSAGES_PREFIX) + messages_from_attributes(
        attributes, OUTPUT_MESSAGES_PREFIX
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
