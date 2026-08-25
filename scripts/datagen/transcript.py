"""Hygiene checks that keep datagen's own vocabulary out of generated transcripts.

Imports the standard library only, so the recorder scripts in this directory can
share it with the quality gate, which reaches the runtime schema package.
"""

from __future__ import annotations

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
