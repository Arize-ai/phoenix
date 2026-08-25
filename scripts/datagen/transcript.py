"""Hygiene checks that keep datagen's own vocabulary out of generated transcripts.

Imports the standard library only, so the recorder scripts in this directory can
share it with the quality gate, which reaches the runtime schema package.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

RESERVED_TRANSCRIPT_PHRASES = (
    "adversarial seed",
    "seed intensity",
    "targeted seed",
    "make a mistake",
)
BARE_ROLE_NAMES = frozenset({"assistant", "system", "tool", "user"})


def is_bare_role_name(content: str) -> bool:
    """Report whether ``content`` is a role name standing in for a real message."""
    return content.strip().casefold() in BARE_ROLE_NAMES


def contains_internal_context(value: Any, extra_phrases: Sequence[str] = ()) -> bool:
    forbidden = (*RESERVED_TRANSCRIPT_PHRASES, *extra_phrases)
    return any(
        term.casefold() in content.casefold()
        for content in _text_values(value)
        for term in forbidden
    )


def role_transition_is_valid(previous: str | None, role: str, *, allow_tools: bool) -> bool:
    allowed = {
        None: {"user"},
        "user": {"assistant"},
        "assistant": {"user", "tool"} if allow_tools else {"user"},
        "tool": {"assistant", "tool"} if allow_tools else set(),
    }
    return role in allowed.get(previous, set())


def _text_values(value: Any) -> tuple[str, ...]:
    if isinstance(value, str):
        return (value,)
    if isinstance(value, Mapping):
        return tuple(content for item in value.values() for content in _text_values(item))
    if isinstance(value, (list, tuple)):
        return tuple(content for item in value for content in _text_values(item))
    return ()
