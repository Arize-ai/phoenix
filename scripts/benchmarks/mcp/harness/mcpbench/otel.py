"""Replay of stored transcripts as OpenInference spans.

The runs are already on disk, so a trace is a projection rather than a second
measurement: nothing is re-executed, and the spans are built from the same file
the report is built from. That is the point of replaying instead of tracing
live -- the numbers under discussion stay the ones the client produced, and
every run already collected can be looked at as a trace.

What a transcript cannot supply is derived and said so, never invented. The
clock stamps only assistant and user events, so a model call is bracketed by
the boundary before it and its own last event; the run's own reported duration
fixes the root, since the result event carries no timestamp at all.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from openinference.semconv.trace import (
    MessageAttributes,
    MessageContentAttributes,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolAttributes,
    ToolCallAttributes,
)

from .metrics import _call_detail, _error_kind, _payload_error

#: Per-message cap on replayed text. The whole conversation is re-sent on every
#: API call, so an uncapped input history is quadratic in the run and a single
#: paged tool result can outweigh everything else in the trace.
DEFAULT_MAX_CHARS = 4000

_ANTHROPIC = "anthropic"
_JSON_MIME = OpenInferenceMimeTypeValues.JSON.value
_AGENT = OpenInferenceSpanKindValues.AGENT.value
_LLM = OpenInferenceSpanKindValues.LLM.value
_TOOL = OpenInferenceSpanKindValues.TOOL.value


@dataclass
class Span:
    """One span, with the times it actually happened at."""

    name: str
    kind: str
    start: float
    end: float
    attributes: dict[str, Any] = field(default_factory=dict)
    status_error: Optional[str] = None


@dataclass
class _Turn:
    """One API call, accumulated across the events that deliver it."""

    span: Span
    index: int
    content: list[Any] = field(default_factory=list)
    #: Characters the model produced, before any display cap. The only per-call
    #: signal of output size the transcript keeps; see ``_allocate_completion``.
    weight: int = 0
    #: Whether a tool result has arrived since the call opened. Later blocks of
    #: the same message still belong to it, but the call itself was over.
    answered: bool = False


def _stamp(event: dict[str, Any]) -> Optional[float]:
    """Epoch seconds for a transcript event, or ``None`` if it carries no clock."""
    value = event.get("timestamp")
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def _clip(text: str, limit: int) -> str:
    if limit <= 0 or len(text) <= limit:
        return text
    return f"{text[:limit]}… [{len(text) - limit} more characters]"


def _clip_json(payload: Any, limit: int) -> str:
    """Serialise a payload, cutting it down without cutting it open.

    The cap has to fall inside the strings rather than across the document:
    a reader parses these attributes, and a JSON string with the tail sliced
    off is not shorter JSON, it is a string that happens to start with a brace.
    One tool input in the stored corpus is over the cap, and it arrived as
    exactly that -- an unparseable value still labelled `application/json`.
    """
    serialized = json.dumps(payload, default=str)
    if limit <= 0 or len(serialized) <= limit:
        return serialized

    def shrink(node: Any, budget: int) -> Any:
        if isinstance(node, str):
            return _clip(node, budget)
        if isinstance(node, dict):
            return {k: shrink(v, budget) for k, v in node.items()}
        if isinstance(node, list):
            return [shrink(v, budget) for v in node]
        return node

    # Divided among the leaves rather than spent on the first one, so a payload
    # of many fields keeps a readable sample of each.
    leaves = max(1, serialized.count('"') // 2)
    clipped = json.dumps(shrink(payload, max(64, limit // leaves)), default=str)
    if len(clipped) <= limit:
        return clipped
    # Structure too large to survive on its own -- a deep object of short
    # strings. Still valid JSON, and still says what it was.
    return json.dumps({"clipped": _clip(serialized, limit)})


def _text_of(content: Any) -> str:
    """Readable text for a message body, whatever shape it arrived in."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [b.get("text") or "" for b in content if isinstance(b, dict) and b.get("text")]
        if parts:
            return "\n\n".join(parts)
    return json.dumps(content, default=str)


def _prompt_tokens(usage: dict[str, Any]) -> dict[str, Any]:
    """Anthropic prompt usage as OpenInference token counts.

    ``input_tokens`` excludes everything served from or written to cache, while
    ``llm.token_count.prompt`` is the whole prompt with the cached parts named
    as subsets of it. Reported verbatim the two disagree by orders of magnitude
    -- 2 against 1748 on a warm call -- and a consumer that subtracts the
    details to price uncached input would go negative.
    """
    read = int(usage.get("cache_read_input_tokens") or 0)
    written = int(usage.get("cache_creation_input_tokens") or 0)
    fresh = int(usage.get("input_tokens") or 0)
    counts: dict[str, Any] = {SpanAttributes.LLM_TOKEN_COUNT_PROMPT: fresh + read + written}
    if read:
        counts[SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ] = read
    if written:
        counts[SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE] = written
    return counts


def _allocate_completion(turns: list[_Turn], total: int) -> None:
    """Spread the run's output tokens over its calls, in proportion to text.

    The stream reports output tokens per message before the message exists: a
    call that wrote 420 tokens is stamped 2, and the true figure appears once,
    in the result. Only the total is a measurement, so it is the total that is
    preserved -- divided by how much each call actually wrote, which is the one
    per-call signal the transcript does keep, and which tracks tokens closely
    because tokens are what the characters were made of.

    Recorded as an estimate on the span for anyone reading a single call. The
    sum across a run is exact, and the sum is what any comparison uses.
    """
    weights = [t.weight for t in turns]
    if not turns or total <= 0 or not sum(weights):
        return
    # Largest-remainder, so rounding cannot lose or invent a token.
    exact = [total * w / sum(weights) for w in weights]
    given = [int(x) for x in exact]
    for i in sorted(range(len(turns)), key=lambda i: exact[i] - given[i], reverse=True)[
        : total - sum(given)
    ]:
        given[i] += 1
    for turn, tokens in zip(turns, given):
        prompt = turn.span.attributes.get(SpanAttributes.LLM_TOKEN_COUNT_PROMPT, 0)
        turn.span.attributes[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] = tokens
        turn.span.attributes[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] = prompt + tokens


def _tool_definitions(names: list[str]) -> dict[str, Any]:
    """The tool surface the call was offered, as far as the transcript knows it.

    Names only: the client reports which tools were connected, never their
    schemas, so what is recorded is the surface and not its shape. That is the
    axis the benchmark varies -- a run is a measurement of which tools were on
    offer -- and without it a trace cannot say what the model had to choose from.
    """
    return {
        f"{SpanAttributes.LLM_TOOLS}.{i}.{ToolAttributes.TOOL_JSON_SCHEMA}": json.dumps(
            {"type": "function", "function": {"name": name}}
        )
        for i, name in enumerate(names)
    }


def _finish_reason(turn: _Turn, *, last: bool, stopped: Optional[str]) -> str:
    """Why a call ended. Derived, because the stream reports it as null.

    A call that asked for a tool ended to run it; the rest ended their turn,
    and for the final one the result event says how.
    """
    if any(isinstance(b, dict) and b.get("type") == "tool_use" for b in turn.content):
        return "tool_use"
    return (stopped or "end_turn") if last else "end_turn"


def _message_attrs(prefix: str, index: int, message: dict[str, Any], *, detailed: bool) -> dict:
    """One message, flattened to the indexed keys the convention expects.

    Flat rather than a JSON blob because a reader renders a conversation from
    these keys and shows nothing for a string that merely contains one.
    """
    base = f"{prefix}.{index}"
    out: dict[str, Any] = {f"{base}.{MessageAttributes.MESSAGE_ROLE}": message["role"]}
    if content := message.get("content"):
        out[f"{base}.{MessageAttributes.MESSAGE_CONTENT}"] = content
    if tool_call_id := message.get("tool_call_id"):
        out[f"{base}.{MessageAttributes.MESSAGE_TOOL_CALL_ID}"] = tool_call_id
    # Only what the model just produced is broken out block by block. The same
    # detail on every replayed history message would repeat the whole run once
    # per call without saying anything the first copy did not.
    if detailed:
        for j, block in enumerate(message.get("contents") or []):
            slot = f"{base}.{MessageAttributes.MESSAGE_CONTENTS}.{j}"
            out[f"{slot}.{MessageContentAttributes.MESSAGE_CONTENT_TYPE}"] = block["type"]
            out[f"{slot}.{MessageContentAttributes.MESSAGE_CONTENT_TEXT}"] = block["text"]
    for j, call in enumerate(message.get("tool_calls") or []):
        slot = f"{base}.{MessageAttributes.MESSAGE_TOOL_CALLS}.{j}"
        out[f"{slot}.{ToolCallAttributes.TOOL_CALL_ID}"] = call["id"]
        out[f"{slot}.{ToolCallAttributes.TOOL_CALL_FUNCTION_NAME}"] = call["name"]
        out[f"{slot}.{ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON}"] = call["arguments"]
    return out


def _flatten(prefix: str, messages: list[dict[str, Any]], *, detailed: bool = False) -> dict:
    out: dict[str, Any] = {}
    for i, message in enumerate(messages):
        out.update(_message_attrs(prefix, i, message, detailed=detailed))
    return out


def _assistant_message(content: list[Any], limit: int) -> dict[str, Any]:
    """One assistant message as a replayable record of what the model produced."""
    contents, calls, texts = [], [], []
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text" and block.get("text"):
            texts.append(block["text"])
            contents.append({"type": "text", "text": _clip(block["text"], limit)})
        elif block.get("type") == "thinking" and block.get("thinking"):
            # Kept: it is where the model decides what to call next, which is
            # most of what a route is evidence of.
            contents.append({"type": "thinking", "text": _clip(block["thinking"], limit)})
        elif block.get("type") == "tool_use":
            calls.append(
                {
                    "id": str(block.get("id") or ""),
                    "name": str(block.get("name") or ""),
                    "arguments": _clip_json(block.get("input"), limit),
                }
            )
    message: dict[str, Any] = {"role": "assistant"}
    if texts:
        message["content"] = _clip("\n\n".join(texts), limit)
    if contents:
        message["contents"] = contents
    if calls:
        message["tool_calls"] = calls
    return message


def _block_weight(block: Any) -> int:
    if not isinstance(block, dict):
        return 0
    if text := block.get("text") or block.get("thinking"):
        return len(str(text))
    if block.get("type") == "tool_use":
        return len(json.dumps(block.get("input"), default=str))
    return 0


def _events(path: Path) -> list[dict[str, Any]]:
    """Every readable event in a transcript. A truncated last line is tolerated."""
    events = []
    for line in path.read_text(errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(event, dict):
            events.append(event)
    return events


def build_spans(
    path: Path,
    *,
    prompt: str,
    metadata: dict[str, Any],
    session_id: Optional[str] = None,
    max_chars: int = DEFAULT_MAX_CHARS,
) -> list[Span]:
    """Every span for one transcript, the root first.

    Model calls and tool calls are both children of the run. Nesting a tool
    under the call that asked for it would read as containment, and it is the
    opposite: the tool call starts where the model call ends.
    """
    events = _events(path)
    init = next((e for e in events if e.get("subtype") == "init"), {})
    result = next((e for e in events if e.get("type") == "result"), {})
    stamps = [t for e in events if (t := _stamp(e)) is not None]
    if not stamps:
        return []

    # The result event has no clock, so the run is anchored on its last stamped
    # event and stretched back by the duration it reported. Deriving the start
    # instead of the end keeps the root exactly as long as the run says it was.
    end = max(stamps)
    duration = result.get("duration_ms")
    start = end - duration / 1000 if isinstance(duration, (int, float)) else min(stamps)

    tools = _tool_definitions([str(t) for t in init.get("tools") or []])
    history: list[dict[str, Any]] = [{"role": "user", "content": _clip(prompt, max_chars)}]
    spans: list[Span] = []
    turns: dict[str, _Turn] = {}
    ordered: list[_Turn] = []
    pending: dict[str, tuple[Span, dict[str, Any]]] = {}
    # Where the next model call began: the run's start for the first, and the
    # last thing the model saw for every one after it.
    boundary = start + (result.get("time_to_request_ms") or 0) / 1000

    for event in events:
        kind = event.get("type")
        at = _stamp(event)
        if at is None:
            continue
        if kind == "assistant":
            message = event.get("message") or {}
            message_id = str(message.get("id") or "")
            turn = turns.get(message_id)
            if turn is None:
                span = Span(
                    name="Messages",
                    kind=_LLM,
                    start=boundary,
                    end=at,
                    attributes={
                        SpanAttributes.LLM_MODEL_NAME: (
                            message.get("model") or init.get("model") or ""
                        ),
                        SpanAttributes.LLM_PROVIDER: _ANTHROPIC,
                        SpanAttributes.LLM_SYSTEM: _ANTHROPIC,
                        **_prompt_tokens(message.get("usage") or {}),
                        **tools,
                        **_flatten(SpanAttributes.LLM_INPUT_MESSAGES, history),
                    },
                )
                span.attributes[SpanAttributes.METADATA] = json.dumps(
                    {
                        "request_id": event.get("request_id"),
                        # Named on the span because nothing downstream can tell
                        # a derived number from a measured one: the cost model
                        # prices this completion count, and a reader comparing
                        # a single call would otherwise read an estimate as a
                        # measurement. See `_allocate_completion` and the span
                        # start, which the transcript's clock cannot give.
                        "derived": ["start_time"],
                        "estimated": [SpanAttributes.LLM_TOKEN_COUNT_COMPLETION],
                    }
                )
                spans.append(span)
                turn = _Turn(span=span, index=len(history))
                turns[message_id] = turn
                ordered.append(turn)
                history.append({"role": "assistant"})
            # One API call arrives as several events -- thinking, then text or
            # tool_use -- and its later blocks can be delivered after a tool
            # result. They belong to the call either way, but the call itself
            # ended when the first of its tools was answered.
            elif not turn.answered:
                turn.span.end = at
            for block in message.get("content") or []:
                turn.content.append(block)
                turn.weight += _block_weight(block)
            rendered = _assistant_message(turn.content, max_chars)
            history[turn.index] = rendered
            turn.span.attributes.update(
                _flatten(SpanAttributes.LLM_OUTPUT_MESSAGES, [rendered], detailed=True)
            )
            # Only the output. The input is already on the span as flattened
            # messages, and a second serialised copy would roughly double the
            # largest spans to say the same thing twice.
            calls = ", ".join(c["name"] for c in rendered.get("tool_calls") or [])
            turn.span.attributes[SpanAttributes.OUTPUT_VALUE] = rendered.get("content") or calls

            for block in message.get("content") or []:
                if not isinstance(block, dict) or block.get("type") != "tool_use":
                    continue
                name = str(block.get("name") or "")
                payload = block.get("input")
                arguments = _clip_json(payload, max_chars)
                call = Span(
                    name=name.split("__")[-1],
                    kind=_TOOL,
                    start=at,
                    end=at,
                    attributes={
                        SpanAttributes.TOOL_NAME: name,
                        SpanAttributes.TOOL_PARAMETERS: arguments,
                        ToolCallAttributes.TOOL_CALL_ID: str(block.get("id") or ""),
                        SpanAttributes.INPUT_VALUE: arguments,
                        SpanAttributes.INPUT_MIME_TYPE: _JSON_MIME,
                    },
                )
                spans.append(call)
                if use_id := block.get("id"):
                    pending[str(use_id)] = (call, {"detail": _call_detail(name, payload)})
            boundary = at
        elif kind == "user":
            for block in (event.get("message") or {}).get("content") or []:
                if not isinstance(block, dict) or block.get("type") != "tool_result":
                    continue
                for open_turn in turns.values():
                    open_turn.answered = True
                use_id = str(block.get("tool_use_id") or "")
                entry = pending.pop(use_id, None)
                if entry is None:
                    continue
                call, detail = entry
                body = block.get("content")
                serialized = json.dumps(body, default=str)
                text = _text_of(body)
                # The sandbox reports some failures as ordinary results, so the
                # body is classified rather than trusting the error flag alone.
                error_kind = _error_kind(serialized) or _payload_error(body)
                call.end = at
                call.attributes[SpanAttributes.OUTPUT_VALUE] = _clip(text, max_chars)
                call.attributes[SpanAttributes.METADATA] = json.dumps(
                    {**detail, "error_kind": error_kind, "result_bytes": len(serialized)}
                )
                if block.get("is_error") or error_kind:
                    call.status_error = error_kind or "tool error"
                history.append(
                    {"role": "tool", "content": _clip(text, max_chars), "tool_call_id": use_id}
                )
            boundary = at

    for call, detail in pending.values():
        # Issued and never answered -- the run ended first. Left as it was
        # opened, it reads as a call that returned instantly and succeeded,
        # which is the opposite of what happened.
        call.end = end
        call.status_error = "no result"
        call.attributes[SpanAttributes.METADATA] = json.dumps({**detail, "answered": False})

    _allocate_completion(ordered, int((result.get("usage") or {}).get("output_tokens") or 0))
    for i, turn in enumerate(ordered):
        turn.span.attributes[SpanAttributes.LLM_FINISH_REASON] = _finish_reason(
            turn, last=i == len(ordered) - 1, stopped=result.get("stop_reason")
        )

    answer = str(result.get("result") or "")
    # Lifted out rather than copied: they are their own attribute, and leaving
    # them in the blob renders the same list twice.
    tags = [t for t in metadata.pop("tags", None) or [] if t]
    root = Span(
        name=path.stem,
        kind=_AGENT,
        start=start,
        end=end,
        attributes={
            SpanAttributes.INPUT_VALUE: prompt,
            SpanAttributes.OUTPUT_VALUE: _clip(answer, max_chars),
            SpanAttributes.LLM_MODEL_NAME: init.get("model") or "",
            SpanAttributes.METADATA: json.dumps(metadata, default=str),
            SpanAttributes.TAG_TAGS: tags,
        },
    )
    if session_id:
        root.attributes[SpanAttributes.SESSION_ID] = session_id
    if result.get("is_error") or metadata.get("invalid_reason"):
        root.status_error = str(metadata.get("invalid_reason") or result.get("subtype") or "error")
    return [root, *spans]
