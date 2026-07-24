import json
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence

CHARS_PER_TOKEN = 4

_ROLE_LABELS = {
    "system": "System",
    "user": "User",
    "assistant": "Assistant",
    "tool": "Tool",
}

_TRUNCATION_MARKER = " ...[truncated]... "
_BACKSTOP_MARKER = "[... earlier context truncated ...]\n"

DEFAULT_INCLUDE_ROLES = ("user", "assistant", "tool")


def _unwrap(value: Any, key: str) -> Any:
    if isinstance(value, Mapping) and key in value:
        return value[key]
    return value


def _content_from_contents(contents: Any) -> Optional[str]:
    if not isinstance(contents, Sequence) or isinstance(contents, str):
        return None
    parts: List[str] = []
    for element in contents:
        block = _unwrap(element, "message_content")
        if isinstance(block, Mapping):
            text = block.get("text")
            if isinstance(text, str):
                parts.append(text)
    return "\n\n".join(parts) if parts else None


def _reconstruct_tool_calls(message: Mapping[str, Any]) -> List[Dict[str, Any]]:
    calls: List[Dict[str, Any]] = []
    raw = message.get("tool_calls")
    if isinstance(raw, Sequence) and not isinstance(raw, str):
        for element in raw:
            tool_call = _unwrap(element, "tool_call")
            if not isinstance(tool_call, Mapping):
                continue
            function = tool_call.get("function")
            if isinstance(function, Mapping):
                calls.append(
                    {
                        "function": {
                            "name": function.get("name") or "",
                            "arguments": function.get("arguments", ""),
                        }
                    }
                )
    function_call = message.get("function_call")
    if isinstance(function_call, Mapping) and (
        function_call.get("name") or function_call.get("arguments") is not None
    ):
        calls.append(
            {
                "function": {
                    "name": function_call.get("name") or "",
                    "arguments": function_call.get("arguments", ""),
                }
            }
        )
    return calls


def reconstruct_messages(oi_messages: Any) -> List[Dict[str, Any]]:
    """Convert OpenInference message attributes into plain message dicts.

    Accepts the ``llm.input_messages`` / ``llm.output_messages`` value as
    returned by the Phoenix client (a list of ``{"message": {...}}`` elements,
    with tool calls nested as ``{"tool_call": {"function": {...}}}``) and
    returns messages in the ``{role, content, tool_calls, name}`` shape consumed
    by :func:`build_conversation_context`. Elements already in the flat shape are
    passed through, so the function is idempotent.

    Args:
        oi_messages: The message list from a span's attributes, or ``None``.

    Returns:
        Reconstructed messages, oldest first. Empty when ``oi_messages`` is not
        a usable sequence.
    """
    if not isinstance(oi_messages, Sequence) or isinstance(oi_messages, str):
        return []
    result: List[Dict[str, Any]] = []
    for element in oi_messages:
        message = _unwrap(element, "message")
        if not isinstance(message, Mapping):
            continue
        content = message.get("content")
        if content is None:
            content = _content_from_contents(message.get("contents"))
        reconstructed: Dict[str, Any] = {"role": message.get("role") or "assistant"}
        if content is not None:
            reconstructed["content"] = content
        name = message.get("name")
        if name is not None:
            reconstructed["name"] = name
        tool_calls = _reconstruct_tool_calls(message)
        if tool_calls:
            reconstructed["tool_calls"] = tool_calls
        result.append(reconstructed)
    return result


def _role_of(message: Mapping[str, Any]) -> str:
    return str(message.get("role") or "").lower()


def _content_to_str(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    try:
        return json.dumps(content, ensure_ascii=False)
    except (TypeError, ValueError):
        return str(content)


def _tool_calls_of(message: Mapping[str, Any]) -> Sequence[Mapping[str, Any]]:
    tool_calls = message.get("tool_calls")
    if isinstance(tool_calls, Sequence) and not isinstance(tool_calls, str):
        return [tc for tc in tool_calls if isinstance(tc, Mapping)]
    return []


def _render_tool_call(tool_call: Mapping[str, Any]) -> str:
    function = tool_call.get("function")
    function = function if isinstance(function, Mapping) else {}
    name = function.get("name") or ""
    arguments = function.get("arguments", "")
    if not isinstance(arguments, str):
        arguments = _content_to_str(arguments)
    return f"[tool_call: {name}({arguments})]"


def _approx_token_count(text: str) -> int:
    return (len(text) + CHARS_PER_TOKEN - 1) // CHARS_PER_TOKEN


def _truncate_middle(text: str, char_limit: int) -> str:
    if len(text) <= char_limit:
        return text
    budget = char_limit - len(_TRUNCATION_MARKER)
    if budget <= 0:
        return text[:char_limit]
    head = budget // 2
    tail = budget - head
    return text[:head] + _TRUNCATION_MARKER + text[-tail:]


def _omission_marker(count: int) -> str:
    noun = "message" if count == 1 else "messages"
    return f"[... {count} earlier {noun} omitted ...]"


def _render_message(
    message: Mapping[str, Any],
    include_tool_calls: bool,
) -> Optional[str]:
    role = _role_of(message)
    label = _ROLE_LABELS.get(role, role.capitalize() or "Unknown")

    name = message.get("name")
    if role == "tool" and name:
        label = f"{label} ({name})"

    parts: List[str] = []
    content = _content_to_str(message.get("content"))
    if content:
        parts.append(content)
    if include_tool_calls:
        parts.extend(_render_tool_call(tc) for tc in _tool_calls_of(message))

    if not parts:
        return None
    return f"{label}: " + "\n".join(parts)


def build_conversation_context(
    messages: Sequence[Mapping[str, Any]],
    *,
    include_roles: Sequence[str] = DEFAULT_INCLUDE_ROLES,
    include_tool_calls: bool = True,
    max_turns: Optional[int] = None,
    max_context_tokens: Optional[int] = 8000,
    per_message_char_limit: Optional[int] = 4000,
    max_total_chars: Optional[int] = None,
    token_counter: Optional[Callable[[str], int]] = None,
    separator: str = "\n",
) -> str:
    """Assemble a bounded conversation transcript for grounding an eval.

    Takes reconstructed messages (oldest first, in the ``{role, content,
    tool_calls, name}`` shape produced by the span message extractor) and
    applies four independent controls to keep the transcript within a budget:

    1. Selection: keep only ``include_roles``; render assistant tool calls only
       when ``include_tool_calls`` is set.
    2. Per-message truncation: cap each message at ``per_message_char_limit``
       using head+tail truncation so a single large tool result cannot dominate.
    3. Windowing: drop oldest messages until at most ``max_turns`` remain and the
       total is within ``max_context_tokens``. Dropped messages are replaced by a
       single omission marker.
    4. Backstop: hard-cap the final string at ``max_total_chars``, keeping the
       most recent characters.

    Args:
        messages: Reconstructed messages, oldest first. The message under
            judgment should not be included here; supply it to the evaluator
            separately so it is never truncated by these controls.
        include_roles: Roles to keep. Defaults to user, assistant, and tool
            (system prompts are excluded).
        include_tool_calls: Whether to render assistant tool-call invocations.
        max_turns: Optional cap on the number of messages kept (most recent).
        max_context_tokens: Token budget for the assembled transcript. Counted
            with ``token_counter`` if given, otherwise a character-based
            approximation.
        per_message_char_limit: Optional per-message character cap.
        max_total_chars: Optional hard cap on the returned string length.
        token_counter: Optional callable returning a token count for a string.
        separator: String joining rendered messages.

    Returns:
        The assembled transcript, or an empty string when nothing remains after
        selection.
    """
    count_tokens = token_counter or _approx_token_count

    rendered: List[str] = []
    for message in messages:
        if _role_of(message) not in include_roles:
            continue
        text = _render_message(message, include_tool_calls=include_tool_calls)
        if text is None:
            continue
        if per_message_char_limit is not None:
            text = _truncate_middle(text, per_message_char_limit)
        rendered.append(text)

    if not rendered:
        return ""

    dropped = 0
    if max_turns is not None and len(rendered) > max_turns:
        dropped += len(rendered) - max_turns
        rendered = rendered[-max_turns:]

    if max_context_tokens is not None:
        token_counts = [count_tokens(text) for text in rendered]
        while len(rendered) > 1 and sum(token_counts) > max_context_tokens:
            rendered.pop(0)
            token_counts.pop(0)
            dropped += 1

    if dropped:
        rendered.insert(0, _omission_marker(dropped))

    context = separator.join(rendered)

    if max_total_chars is not None and len(context) > max_total_chars:
        keep = max_total_chars - len(_BACKSTOP_MARKER)
        context = _BACKSTOP_MARKER + context[-keep:] if keep > 0 else context[-max_total_chars:]

    return context
