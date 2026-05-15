"""Shared text-hygiene helpers for sandbox backends.

Centralizes ANSI escape stripping so every backend can present clean text on
every field of ``ExecutionResult`` (stdout, stderr, error). Consumers downstream
of ``ExecutionResult`` — the runner today, future replay tooling, error returns,
log forwarders — see pre-stripped text without needing to know the strip exists.
"""

from __future__ import annotations

import re
from typing import Optional

_ANSI_ESCAPE_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")


def strip_ansi(text: str) -> str:
    """Remove ANSI CSI escape sequences from ``text``."""
    return _ANSI_ESCAPE_RE.sub("", text)


def strip_ansi_optional(text: Optional[str]) -> Optional[str]:
    """ANSI-strip ``text`` while preserving ``None`` (used for ``ExecutionResult.error``)."""
    if text is None:
        return None
    return _ANSI_ESCAPE_RE.sub("", text)
