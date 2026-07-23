"""Readable conversation rendering for the user_friction eval.

Two tiers:
- Prior turns (everything before the turn being reacted to): user/assistant
  text plus a one-line action summary per turn's tool calls; ask_user
  questions shown as text. No raw args or outputs.
- The turn being reacted to (immediately before the new user message):
  detailed — tool names with trimmed human-readable results (errors kept),
  full ask_user questions + options.

Cache note: a turn's compact form never changes once it enters history, so
the rendered prefix is append-only per session (provider prefix caching
applies); the detailed last turn lives in the varying suffix.
"""

from __future__ import annotations

from typing import Any

from evals.pxi.online_evals.conversation import Message, Turn
from evals.pxi.online_evals.message_origin import is_human_message

_ERROR_MARKERS = ("error", "exception", "traceback", "failed")


def _looks_like_error(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in _ERROR_MARKERS)


def _ask_user_questions(call: dict[str, Any]) -> list[str]:
    args = call.get("args")
    if not isinstance(args, dict):
        return []
    rendered: list[str] = []
    for q in args.get("questions", []):
        if not isinstance(q, dict):
            continue
        prompt = str(q.get("prompt", "")).strip()
        options = [
            str(o.get("label", "")).strip()
            for o in q.get("options", []) or []
            if isinstance(o, dict)
        ]
        line = f'"{prompt}"'
        if options:
            line += " — options: " + " / ".join(o for o in options if o)
        rendered.append(line)
    return rendered


def _tool_results(turn: Turn) -> list[str]:
    return [m.content or "" for m in turn.messages if m.role == "tool"]


def _trim(text: str, limit: int) -> str:
    text = text.strip()
    return text if len(text) <= limit else text[:limit] + "…"


def render_turn_compact(turn: Turn) -> str:
    """One prior turn with role headings and a one-line action summary."""
    lines: list[str] = [f"### User\n{turn.user_message.strip()}"]
    results = _tool_results(turn)
    summaries: list[str] = []
    ask_lines: list[str] = []
    for i, call in enumerate(turn.tool_calls):
        name = str(call.get("name") or "?")
        if name == "ask_user":
            for q in _ask_user_questions(call):
                ask_lines.append(f"[agent asked: {q}]")
            continue
        outcome = "✗ error" if i < len(results) and _looks_like_error(results[i]) else "✓"
        summaries.append(f"{name} {outcome}")
    if summaries:
        lines.append(f"> Tools ({len(summaries)}): " + ", ".join(summaries))
    for msg in turn.messages:
        if msg.role == "assistant" and (msg.content or "").strip():
            lines.append(f"### Assistant\n{msg.content.strip()}")
    lines.extend(ask_lines)
    return "\n".join(lines)


def render_turn_detailed(turn: Turn) -> str:
    """The turn being reacted to with compact, readable tool activity."""
    lines: list[str] = [f"### User\n{turn.user_message.strip()}"]
    results = _tool_results(turn)
    result_index = 0
    for msg in turn.messages:
        if msg.role == "assistant":
            if (msg.content or "").strip():
                lines.append(f"### Assistant\n{msg.content.strip()}")
            for call in msg.tool_calls:
                name = str(call.get("name") or "?")
                if name == "ask_user":
                    for q in _ask_user_questions(call):
                        lines.append(f"[agent asked: {q}]")
                    result_index += 1
                    continue
                lines.append(f"> Tool: {name}")
                if result_index < len(results):
                    result = results[result_index]
                    if _looks_like_error(result):
                        lines.append(f"> Error: {_trim(result, 220)}")
                result_index += 1
    return "\n".join(lines)


def render_conversation(turns: list[Turn], target_index: int) -> str:
    """Render everything before ``turns[target_index]`` in two tiers.

    ``turns[target_index]`` is the turn whose user message is being labeled;
    ``turns[target_index - 1]`` is the turn being reacted to (detailed);
    earlier turns are compact.
    """
    parts: list[str] = []
    for i in range(target_index):
        if not is_human_message(turns[i].user_message):
            continue
        if i == target_index - 1:
            parts.append(render_turn_detailed(turns[i]))
        else:
            parts.append(render_turn_compact(turns[i]))
    return "\n\n".join(parts)


__all__ = ["Message", "render_conversation", "render_turn_compact", "render_turn_detailed"]
