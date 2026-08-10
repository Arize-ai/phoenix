"""Human-readable formatting of chat message trajectories for LLM-as-a-judge evals.

LLM-as-a-judge prompt templates use simple variables like ``{{input}}`` or
``{{conversation}}`` that expect a human-readable **string** rendering of a turn-by-turn
conversation. Raw message data, however, reaches an eval in several different physical
shapes depending on where it came from, and none of them is exactly the OpenAI Chat
Completions shape:

#. ``client.spans.get_spans_dataframe()`` cells (``attributes.llm.input_messages``) use
   dotted, semantic-convention keys: ``{"message.role": ..., "message.content": ...,
   "message.tool_calls": [{"tool_call.function.name": ...}]}``.
#. ``SpanQuery().select(...)`` / raw ``get_spans()`` use OTEL-nested dicts:
   ``{"message": {"role": ..., "tool_calls": [{"tool_call": {"function": {...}}}]}}``.
#. Dataset example inputs use an OpenAI-ish flat shape:
   ``{"role": ..., "tool_calls": [{"function": {"name": ..., "arguments": {...}}}]}``.
#. Hand-written / OpenAI SDK dicts: ``{"role": ..., "tool_calls": [{"id": ..., "type":
   "function", "function": {...}}]}``.

:func:`normalize_messages` collapses all of these into a canonical list of
:class:`NormalizedMessage` objects, and :func:`format_messages` renders that canonical
list into a stable, role-labeled transcript with independent detail dials for tool calls
and tool results.

In addition to a list of message-shaped dicts, the functions also accept:

* **Flat LLM span attributes** — the fully-flattened, dotted, index-numbered mapping a
  span carries (e.g. ``{"llm.input_messages.0.message.role": "user", ...}``). The
  ``llm.input_messages`` and ``llm.output_messages`` arrays are unflattened and
  concatenated in order.
* **Native provider-SDK message objects** — Anthropic block-list messages
  (``content`` is a list of ``{"type": "text"|"tool_use"|"tool_result", ...}`` blocks) and
  Google/Gemini ``parts`` messages (``{"role": "model", "parts": [{"text"},
  {"functionCall"}, {"functionResponse"}]}``). These are translated into the canonical
  OpenAI-shaped form, which Phoenix uses as its standard. Note that LLM spans are already
  provider-normalized by OpenInference instrumentation, so the native-shape support only
  matters when raw provider SDK objects are passed in directly.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Collection, Dict, List, Mapping, Optional, Sequence, Union, cast

from openinference.semconv.trace import (
    MessageAttributes,
    MessageContentAttributes,
    SpanAttributes,
    ToolCallAttributes,
)

from .llm.prompts import _ROLE_ALIASES

__all__ = [
    "ToolCall",
    "NormalizedMessage",
    "normalize_messages",
    "format_messages",
    "OMITTED_MESSAGES_MARKER",
    "OMITTED_LATER_MESSAGES_MARKER",
    "TRUNCATION_MARKER",
]

# --- Public truncation contract -------------------------------------------------------
# These markers are part of the public contract: judge prompts may refer to them, so they
# are documented and stable, not implementation detail.
OMITTED_MESSAGES_MARKER = "[... {n} earlier messages omitted ...]"
OMITTED_LATER_MESSAGES_MARKER = "[... {n} later messages omitted ...]"
TRUNCATION_MARKER = "...[truncated]..."

# Semantic-convention keys used by the dotted-key (dataframe) shape.
_MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE  # "message.role"
_MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT  # "message.content"
_MESSAGE_CONTENTS = MessageAttributes.MESSAGE_CONTENTS  # "message.contents"
_MESSAGE_NAME = MessageAttributes.MESSAGE_NAME  # "message.name"
_MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS  # "message.tool_calls"
_MESSAGE_TOOL_CALL_ID = MessageAttributes.MESSAGE_TOOL_CALL_ID  # "message.tool_call_id"
_MESSAGE_FUNCTION_CALL_NAME = MessageAttributes.MESSAGE_FUNCTION_CALL_NAME
_MESSAGE_FUNCTION_CALL_ARGS = MessageAttributes.MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON
_TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID  # "tool_call.id"
_TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME  # "tool_call.function.name"
_TOOL_CALL_FUNCTION_ARGS = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON
_CONTENT_TYPE = MessageContentAttributes.MESSAGE_CONTENT_TYPE  # "message_content.type"
_CONTENT_TEXT = MessageContentAttributes.MESSAGE_CONTENT_TEXT  # "message_content.text"
_LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES  # "llm.input_messages"
_LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES  # "llm.output_messages"

_TOOL_ROLES = {"tool", "function"}
_ERROR_MARKERS = ("error", "exception", "traceback", "failed")

# Native provider-SDK content-block / part type markers.
_ANTHROPIC_TOOL_USE = "tool_use"
_ANTHROPIC_TOOL_RESULT = "tool_result"
_ANTHROPIC_BLOCK_TYPES = {_ANTHROPIC_TOOL_USE, _ANTHROPIC_TOOL_RESULT}
_GEMINI_FUNCTION_CALL = "functionCall"
_GEMINI_FUNCTION_RESPONSE = "functionResponse"


@dataclass(frozen=True)
class ToolCall:
    """A normalized tool/function call issued by an assistant message.

    Attributes:
        name: The tool/function name, or ``None`` if it could not be determined.
        arguments: The call arguments, JSON-decoded to a Python object when possible,
            otherwise the raw string as provided.
        id: The provider tool-call id, if present.
    """

    name: Optional[str]
    arguments: Any = None
    id: Optional[str] = None


@dataclass(frozen=True)
class NormalizedMessage:
    """A canonical chat message, independent of the original wire shape.

    Attributes:
        role: Canonical role: ``"system"``, ``"user"``, ``"assistant"``, ``"tool"``, or
            the lowercased original for unrecognized roles.
        content: The message text (non-string content is JSON-serialized).
        tool_calls: Tool calls issued by an assistant message.
        tool_call_id: The id of the tool call this message is a result for (tool messages).
        name: The tool/function name for tool-result messages, if present.
        is_error: Whether a tool-result message is an error, when the source states it
            explicitly (e.g. Anthropic ``is_error``). ``None`` means "unknown" and callers
            fall back to a text heuristic.
    """

    role: str
    content: str = ""
    tool_calls: List[ToolCall] = field(default_factory=list)
    tool_call_id: Optional[str] = None
    name: Optional[str] = None
    is_error: Optional[bool] = None


MessageLike = Union[Mapping[str, Any], NormalizedMessage]


# --- Normalization --------------------------------------------------------------------
def _canonical_role(role: Any) -> str:
    role_str = str(role or "").strip().lower()
    if role_str in _TOOL_ROLES:
        return "tool"
    alias = _ROLE_ALIASES.get(role_str)
    if alias is not None:
        return alias.value
    return role_str


def _get(body: Mapping[str, Any], plain_key: str, dotted_key: str) -> Any:
    """Read a field that may be stored plainly or under a dotted semconv key."""
    if plain_key in body:
        return body[plain_key]
    return body.get(dotted_key)


def _decode_arguments(arguments: Any) -> Any:
    """JSON-decode string arguments; leave already-decoded values untouched."""
    if isinstance(arguments, str):
        try:
            return json.loads(arguments)
        except (json.JSONDecodeError, ValueError):
            return arguments
    return arguments


def _text_from_content_parts(parts: Any) -> str:
    """Join the text of multi-part content into a single string."""
    if not isinstance(parts, (list, tuple)):
        return ""
    texts: List[str] = []
    for part in parts:
        if not isinstance(part, Mapping):
            continue
        # Nested (``{"message_content": {"type": "text", "text": ...}}``) or flat.
        inner = part.get("message_content")
        block = inner if isinstance(inner, Mapping) else part
        part_type = block.get("type") or block.get(_CONTENT_TYPE)
        text = block.get("text")
        if text is None:
            text = block.get(_CONTENT_TEXT)
        if isinstance(text, str) and (part_type in (None, "text")):
            texts.append(text)
    return "\n".join(texts)


def _stringify_content(content: Any, parts: Any) -> str:
    if isinstance(content, str) and content:
        return content
    if content not in (None, ""):
        # e.g. a list of OpenAI content parts passed as ``content``.
        parts_text = _text_from_content_parts(content)
        if parts_text:
            return parts_text
        return json.dumps(content, default=str)
    parts_text = _text_from_content_parts(parts)
    return parts_text


def _normalize_tool_call(entry: Any) -> Optional[ToolCall]:
    if not isinstance(entry, Mapping):
        return None
    # Unwrap the OTEL-nested ``{"tool_call": {...}}`` shape.
    inner = entry.get("tool_call")
    call: Mapping[str, Any] = inner if isinstance(inner, Mapping) else entry
    function = call.get("function")
    function = function if isinstance(function, Mapping) else {}

    name = function.get("name")
    if name is None:
        name = call.get(_TOOL_CALL_FUNCTION_NAME)  # dotted (dataframe) shape

    if "arguments" in function:
        raw_args = function.get("arguments")
    else:
        raw_args = call.get(_TOOL_CALL_FUNCTION_ARGS)

    call_id = call.get("id")
    if call_id is None:
        call_id = call.get(_TOOL_CALL_ID)

    return ToolCall(
        name=str(name) if name is not None else None,
        arguments=_decode_arguments(raw_args),
        id=str(call_id) if call_id is not None else None,
    )


def _normalize_tool_calls(raw: Any) -> List[ToolCall]:
    if not isinstance(raw, (list, tuple)):
        return []
    calls: List[ToolCall] = []
    for entry in raw:
        call = _normalize_tool_call(entry)
        if call is not None:
            calls.append(call)
    return calls


def _normalize_openai_message(body: Mapping[str, Any]) -> NormalizedMessage:
    """Normalize an OpenAI / OpenInference message body (flat, dotted, or nested)."""
    role = _canonical_role(_get(body, "role", _MESSAGE_ROLE))
    content = _stringify_content(
        _get(body, "content", _MESSAGE_CONTENT),
        _get(body, "contents", _MESSAGE_CONTENTS),
    )

    tool_calls = _normalize_tool_calls(_get(body, "tool_calls", _MESSAGE_TOOL_CALLS))
    # Fold the legacy single ``function_call`` into the unified tool_calls list.
    legacy_name = _get(body, "function_call_name", _MESSAGE_FUNCTION_CALL_NAME)
    if (
        not tool_calls
        and (legacy_call := body.get("function_call"))
        and isinstance(legacy_call, Mapping)
    ):
        legacy = _normalize_tool_call({"function": legacy_call})
        if legacy is not None:
            tool_calls = [legacy]
    elif not tool_calls and legacy_name is not None:
        tool_calls = [
            ToolCall(
                name=str(legacy_name),
                arguments=_decode_arguments(
                    _get(body, "function_call_arguments_json", _MESSAGE_FUNCTION_CALL_ARGS)
                ),
            )
        ]

    tool_call_id = _get(body, "tool_call_id", _MESSAGE_TOOL_CALL_ID)
    name = _get(body, "name", _MESSAGE_NAME)

    return NormalizedMessage(
        role=role,
        content=content,
        tool_calls=tool_calls,
        tool_call_id=str(tool_call_id) if tool_call_id is not None else None,
        name=str(name) if name is not None else None,
    )


def _stringify_result(content: Any) -> str:
    """Stringify a tool-result payload (string, block-list, or arbitrary object)."""
    if isinstance(content, str):
        return content
    if isinstance(content, (list, tuple)):
        text = _text_from_content_parts(content)
        if text:
            return text
    if content in (None, ""):
        return ""
    return json.dumps(content, default=str)


def _normalize_anthropic_message(body: Mapping[str, Any]) -> List[NormalizedMessage]:
    """Translate a native Anthropic block-list message into canonical messages.

    Anthropic assistant messages carry ``tool_use`` blocks; tool outputs arrive as
    ``tool_result`` blocks inside a ``user`` message. A single message may therefore expand
    into several canonical messages (tool results + the accompanying text).
    """
    role = _canonical_role(body.get("role"))
    blocks = body.get("content")
    text_parts: List[str] = []
    tool_calls: List[ToolCall] = []
    tool_results: List[NormalizedMessage] = []
    for block in blocks if isinstance(blocks, (list, tuple)) else []:
        if not isinstance(block, Mapping):
            continue
        block_type = block.get("type")
        if block_type == "text":
            if isinstance(block.get("text"), str):
                text_parts.append(block["text"])
        elif block_type == _ANTHROPIC_TOOL_USE:
            tool_calls.append(
                ToolCall(
                    name=str(block["name"]) if block.get("name") is not None else None,
                    arguments=_decode_arguments(block.get("input")),
                    id=str(block["id"]) if block.get("id") is not None else None,
                )
            )
        elif block_type == _ANTHROPIC_TOOL_RESULT:
            tool_use_id = block.get("tool_use_id")
            tool_results.append(
                NormalizedMessage(
                    role="tool",
                    content=_stringify_result(block.get("content")),
                    tool_call_id=str(tool_use_id) if tool_use_id is not None else None,
                    is_error=bool(block["is_error"]) if "is_error" in block else None,
                )
            )

    messages: List[NormalizedMessage] = list(tool_results)
    text = "\n".join(text_parts)
    if role == "assistant" or text or tool_calls or not tool_results:
        messages.append(NormalizedMessage(role=role, content=text, tool_calls=tool_calls))
    return messages


def _normalize_gemini_message(body: Mapping[str, Any]) -> List[NormalizedMessage]:
    """Translate a native Google/Gemini ``parts`` message into canonical messages.

    Gemini uses ``functionCall`` parts for tool calls and ``functionResponse`` parts for
    tool outputs; ``role`` is ``"model"`` for the assistant.
    """
    role = _canonical_role(body.get("role"))
    text_parts: List[str] = []
    tool_calls: List[ToolCall] = []
    tool_results: List[NormalizedMessage] = []
    for part in body.get("parts") or []:
        if not isinstance(part, Mapping):
            continue
        if isinstance(part.get("text"), str):
            text_parts.append(part["text"])
        elif isinstance(part.get(_GEMINI_FUNCTION_CALL), Mapping):
            call = part[_GEMINI_FUNCTION_CALL]
            tool_calls.append(
                ToolCall(
                    name=str(call["name"]) if call.get("name") is not None else None,
                    arguments=_decode_arguments(call.get("args")),
                )
            )
        elif isinstance(part.get(_GEMINI_FUNCTION_RESPONSE), Mapping):
            response = part[_GEMINI_FUNCTION_RESPONSE]
            tool_results.append(
                NormalizedMessage(
                    role="tool",
                    content=_stringify_result(response.get("response")),
                    name=str(response["name"]) if response.get("name") is not None else None,
                )
            )

    messages: List[NormalizedMessage] = list(tool_results)
    text = "\n".join(text_parts)
    if role == "assistant" or text or tool_calls or not tool_results:
        messages.append(NormalizedMessage(role=role, content=text, tool_calls=tool_calls))
    return messages


def _is_gemini_message(body: Mapping[str, Any]) -> bool:
    return isinstance(body.get("parts"), (list, tuple))


def _is_anthropic_message(body: Mapping[str, Any]) -> bool:
    content = body.get("content")
    if not isinstance(content, (list, tuple)):
        return False
    return any(
        isinstance(block, Mapping) and block.get("type") in _ANTHROPIC_BLOCK_TYPES
        for block in content
    )


def _normalize_one(raw: MessageLike) -> List[NormalizedMessage]:
    """Normalize a single message of any supported shape into one or more messages."""
    if isinstance(raw, NormalizedMessage):
        return [raw]
    if not isinstance(raw, Mapping):
        raise TypeError(f"Each message must be a mapping or NormalizedMessage, got {type(raw)!r}")

    # Unwrap the OTEL-nested ``{"message": {...}}`` shape; other shapes are the body itself.
    inner = raw.get("message")
    body: Mapping[str, Any] = inner if isinstance(inner, Mapping) else raw

    if _is_gemini_message(body):
        return _normalize_gemini_message(body)
    if _is_anthropic_message(body):
        return _normalize_anthropic_message(body)
    return [_normalize_openai_message(body)]


def _listify(obj: Any) -> Any:
    """Convert dicts whose keys are all consecutive integer strings into lists."""
    if not isinstance(obj, dict):
        return obj
    converted = {key: _listify(value) for key, value in obj.items()}
    keys = list(converted.keys())
    if keys and all(isinstance(key, str) and key.isdigit() for key in keys):
        return [converted[key] for key in sorted(keys, key=int)]
    return converted


def _unflatten(flat: Mapping[str, Any]) -> Dict[str, Any]:
    """Rebuild a nested structure from dotted, index-numbered attribute keys."""
    root: Dict[str, Any] = {}
    for key, value in flat.items():
        segments = str(key).split(".")
        cursor = root
        for segment in segments[:-1]:
            nxt = cursor.get(segment)
            if not isinstance(nxt, dict):
                nxt = {}
                cursor[segment] = nxt
            cursor = nxt
        cursor[segments[-1]] = value
    return cast(Dict[str, Any], _listify(root))


def _looks_like_span_attributes(mapping: Mapping[str, Any]) -> bool:
    return any(
        key == _LLM_INPUT_MESSAGES
        or key == _LLM_OUTPUT_MESSAGES
        or key.startswith(f"{_LLM_INPUT_MESSAGES}.")
        or key.startswith(f"{_LLM_OUTPUT_MESSAGES}.")
        or key == "llm"
        for key in mapping
    )


def _messages_from_span_attributes(attributes: Mapping[str, Any]) -> List[Any]:
    """Extract the ordered input + output message dicts from LLM span attributes."""
    data: Mapping[str, Any] = attributes
    if any("." in str(key) for key in attributes):
        data = _unflatten(attributes)
    llm = data.get("llm")
    llm = llm if isinstance(llm, Mapping) else {}
    result: List[Any] = []
    for messages_key in ("input_messages", "output_messages"):
        value = llm.get(messages_key)
        if isinstance(value, (list, tuple)):
            result.extend(value)
    return result


def normalize_messages(
    messages: Union[Mapping[str, Any], Sequence[MessageLike]],
) -> List[NormalizedMessage]:
    """Normalize messages of any supported shape into canonical messages.

    Accepts, in order of what it detects:

    * A **flat LLM span-attributes mapping** (dotted, index-numbered keys such as
      ``llm.input_messages.0.message.role``). Input and output messages are unflattened
      and concatenated.
    * A **sequence of message-shaped mappings** in any supported shape: dataframe
      dotted-key, OTEL-nested, dataset-flat, hand-written OpenAI, native Anthropic
      block-list, or native Google/Gemini ``parts``.
    * Already-normalized :class:`NormalizedMessage` objects (passed through unchanged).

    A single native message may expand into several canonical messages (e.g. an Anthropic
    ``user`` message bundling multiple ``tool_result`` blocks). This lets callers with
    non-OpenAI data normalize once and render many ways.

    Args:
        messages: A flat span-attributes mapping, or a sequence of message-shaped mappings
            (or :class:`NormalizedMessage` objects).

    Returns:
        A list of :class:`NormalizedMessage` in trajectory order.

    Raises:
        TypeError: If ``messages`` is neither a supported mapping nor a sequence, or an
            element is neither a mapping nor a :class:`NormalizedMessage`.

    Examples::

        from phoenix.evals.utils import normalize_messages

        # OTEL-nested (SpanQuery().select(...) output)
        normalize_messages([{"message": {"role": "user", "content": "hi"}}])

        # flat LLM span attributes
        normalize_messages({"llm.input_messages.0.message.role": "user",
                            "llm.input_messages.0.message.content": "hi"})
    """
    if isinstance(messages, Mapping):
        if not _looks_like_span_attributes(messages):
            raise TypeError(
                "A mapping input must be LLM span attributes containing "
                f"'{_LLM_INPUT_MESSAGES}' or '{_LLM_OUTPUT_MESSAGES}' keys."
            )
        raw_messages: Sequence[MessageLike] = _messages_from_span_attributes(messages)
    elif isinstance(messages, (str, bytes)) or not isinstance(messages, Sequence):
        raise TypeError(
            f"messages must be span attributes or a sequence of message dicts, "
            f"got {type(messages)!r}"
        )
    else:
        raw_messages = messages

    normalized: List[NormalizedMessage] = []
    for message in raw_messages:
        normalized.extend(_normalize_one(message))
    return normalized


# --- Rendering ------------------------------------------------------------------------
_ROLE_LABELS = {
    "system": "System",
    "user": "User",
    "assistant": "Assistant",
    "tool": "Tool",
}


def _looks_like_error(text: str) -> bool:
    lowered = text.lower()
    if any(marker in lowered for marker in _ERROR_MARKERS):
        return True
    stripped = lowered.strip()
    return stripped.startswith('{"error"') or stripped.startswith("{'error'")


def _human_size(n: int) -> str:
    if n < 1024:
        return f"{n} chars"
    return f"{n / 1024:.1f} KB"


def _truncate(text: str, limit: Optional[int]) -> str:
    if limit is None or limit < 0 or len(text) <= limit:
        return text
    return text[:limit].rstrip() + TRUNCATION_MARKER


def _render_args(arguments: Any, *, names_only: bool) -> str:
    if names_only:
        return "..."
    if isinstance(arguments, Mapping):
        return ", ".join(
            f"{key}={json.dumps(value, default=str)}" for key, value in arguments.items()
        )
    if arguments in (None, ""):
        return ""
    if isinstance(arguments, str):
        return arguments
    return json.dumps(arguments, default=str)


def _tool_name_for(message: NormalizedMessage, id_to_name: Mapping[str, str]) -> str:
    if message.name:
        return message.name
    if message.tool_call_id and message.tool_call_id in id_to_name:
        return id_to_name[message.tool_call_id]
    return ""


def _render_message(
    message: NormalizedMessage,
    *,
    tool_call_mode: str,
    max_chars_per_message: Optional[int],
    max_chars_per_tool_result: Optional[int],
    include_tool_call_ids: bool,
    id_to_name: Mapping[str, str],
) -> Optional[str]:
    """Render one message to its transcript block, or ``None`` to drop it entirely."""
    if message.role == "tool":
        if tool_call_mode in ("omit", "names"):
            return None
        name = _tool_name_for(message, id_to_name)
        label = f"Tool ({name})" if name else "Tool"
        result = message.content or ""
        if tool_call_mode == "skeleton":
            is_error = (
                message.is_error if message.is_error is not None else _looks_like_error(result)
            )
            status = f"ERROR: {_truncate(result, 120)}" if is_error else "ok"
            size = f" ({_human_size(len(result))})" if result else ""
            return f"{label}: {status}{size}"
        # full
        return f"{label}: {_truncate(result, max_chars_per_tool_result)}"

    label = _ROLE_LABELS.get(message.role, message.role.capitalize() or message.role)
    lines: List[str] = []
    content = message.content.strip() if message.content else ""
    if content:
        lines.append(f"{label}: {_truncate(content, max_chars_per_message)}")

    if message.role == "assistant" and tool_call_mode != "omit":
        names_only = tool_call_mode == "names"
        for call in message.tool_calls:
            name = call.name or "?"
            rendered_args = _render_args(call.arguments, names_only=names_only)
            call_str = f"{name}({rendered_args})"
            if include_tool_call_ids and call.id:
                call_str = f"{call_str} [id={call.id}]"
            lines.append(f"{label}: [tool_call] {call_str}")

    if not lines:
        return None
    return "\n".join(lines)


def format_messages(
    messages: Union[Mapping[str, Any], Sequence[MessageLike]],
    *,
    include_roles: Optional[Collection[str]] = None,
    exclude_roles: Optional[Collection[str]] = None,
    tool_call_mode: str = "full",
    separator: str = "\n",
    max_messages: Optional[int] = None,
    max_chars: Optional[int] = None,
    max_chars_per_message: Optional[int] = None,
    max_chars_per_tool_result: Optional[int] = None,
    truncation: str = "last",
    include_tool_call_ids: bool = False,
) -> str:
    """Render message dicts into a human-readable, role-labeled transcript string.

    The output is a turn-by-turn transcript where every line is prefixed with an
    unambiguous role label and tool calls are visually distinct from prose::

        System: You are a support agent. Today is 2026-07-27.
        User: What's our refund window?
        Assistant: [tool_call] lookup_policy(query="refund window")
        Tool (lookup_policy): Refunds: 30 days from delivery.
        Assistant: Refunds are accepted within 30 days of delivery.

    Args:
        messages: A flat LLM span-attributes mapping, or a sequence of message-shaped
            mappings (any shape accepted by :func:`normalize_messages`, including native
            Anthropic and Google/Gemini messages) or :class:`NormalizedMessage` objects.
        include_roles: If given, only these canonical roles are rendered.
        exclude_roles: Canonical roles to drop. Applied after ``include_roles``.
        tool_call_mode: How much of the tool record to render. One of:

            - ``"omit"``: no tool calls and no tool results.
            - ``"names"``: tool-call names with arguments elided (``name(...)``); no
              tool results. Use when evaluating tool selection.
            - ``"skeleton"``: tool calls with arguments; tool results reduced to
              ``ok`` / ``ERROR: <message>`` plus a size note. Use when invocations and
              failures matter but payloads don't.
            - ``"full"`` (default): tool calls with arguments and full tool results
              (subject to ``max_chars_per_tool_result``).
        separator: String joining rendered messages. Defaults to ``"\\n"``.
        max_messages: Keep at most this many messages; dropped messages are replaced by a
            ``[... N earlier messages omitted ...]`` marker (see ``truncation``).
        max_chars: Coarse cap on the total output length. If exceeded, the string is
            truncated and a ``...[truncated]...`` marker appended.
        max_chars_per_message: Per-message content budget; longer content is elided with
            ``...[truncated]...``.
        max_chars_per_tool_result: Per-tool-result budget in ``"full"`` mode.
        truncation: ``"last"`` (default) keeps the most recent messages; ``"first"``
            keeps the earliest.
        include_tool_call_ids: If ``True``, append ``[id=...]`` to each tool call.

    Returns:
        The rendered transcript string (empty string if nothing remains after filtering).

    Raises:
        ValueError: If ``tool_call_mode`` or ``truncation`` is not a recognized value.

    Examples::

        from phoenix.evals.utils import format_messages

        rows = [
            {"role": "user", "content": "What's our refund window?"},
            {"role": "assistant", "tool_calls": [
                {"function": {"name": "lookup_policy", "arguments": {"query": "refund"}}}]},
            {"role": "tool", "name": "lookup_policy", "content": "Refunds: 30 days."},
        ]
        print(format_messages(rows, tool_call_mode="skeleton"))
    """
    if tool_call_mode not in ("omit", "names", "skeleton", "full"):
        raise ValueError(
            f"tool_call_mode must be one of omit/names/skeleton/full, got {tool_call_mode!r}"
        )
    if truncation not in ("first", "last"):
        raise ValueError(f"truncation must be 'first' or 'last', got {truncation!r}")

    normalized = normalize_messages(messages)

    if include_roles is not None:
        include = {r.lower() for r in include_roles}
        normalized = [m for m in normalized if m.role in include]
    if exclude_roles:
        exclude = {r.lower() for r in exclude_roles}
        normalized = [m for m in normalized if m.role not in exclude]

    # Map tool-call ids to their tool names so tool-result messages can be labeled.
    id_to_name: dict[str, str] = {}
    for message in normalized:
        for call in message.tool_calls:
            if call.id and call.name:
                id_to_name[call.id] = call.name

    omitted_marker: Optional[str] = None
    if max_messages is not None and len(normalized) > max_messages:
        dropped = len(normalized) - max_messages
        if truncation == "last":
            normalized = normalized[-max_messages:]
            omitted_marker = OMITTED_MESSAGES_MARKER.format(n=dropped)
            omit_at_start = True
        else:
            normalized = normalized[:max_messages]
            omitted_marker = OMITTED_LATER_MESSAGES_MARKER.format(n=dropped)
            omit_at_start = False

    blocks: List[str] = []
    for message in normalized:
        block = _render_message(
            message,
            tool_call_mode=tool_call_mode,
            max_chars_per_message=max_chars_per_message,
            max_chars_per_tool_result=max_chars_per_tool_result,
            include_tool_call_ids=include_tool_call_ids,
            id_to_name=id_to_name,
        )
        if block is not None:
            blocks.append(block)

    if omitted_marker is not None:
        if omit_at_start:
            blocks.insert(0, omitted_marker)
        else:
            blocks.append(omitted_marker)

    rendered = separator.join(blocks)

    if max_chars is not None and len(rendered) > max_chars:
        rendered = rendered[:max_chars].rstrip() + TRUNCATION_MARKER

    return rendered
