"""Typed, non-fatal diagnostics for external skill loading.

One malformed skill directory must never break server startup or a chat turn, so
discovery collects diagnostics and skips the offending skill instead of raising.
Codes are enumerated so operators get a consistent, greppable signal.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class SkillDiagnosticCode(Enum):
    """Why an external skill was skipped, or what was adjusted while loading it."""

    SOURCE_MISSING = "source_missing"
    """A configured source directory does not exist. Skipped, not an error."""

    UNSAFE_PATH = "unsafe_path"
    """A path segment escaped its source root, or was otherwise unsafe."""

    UNREADABLE = "unreadable"
    """SKILL.md could not be read from disk."""

    MALFORMED = "malformed"
    """SKILL.md frontmatter is missing, unparseable, or not a mapping."""

    INVALID_NAME = "invalid_name"
    """The skill name is missing or not a valid slug."""

    NAME_MISMATCH = "name_mismatch"
    """The skill name does not match the directory that contains it."""

    INVALID_DESCRIPTION = "invalid_description"
    """The description is empty or longer than the allowed maximum."""

    TOO_LARGE = "too_large"
    """The skill body exceeds the size cap."""

    NAME_COLLISION = "name_collision"
    """Another skill already claims this name. First-party skills win."""

    IGNORED_FIELD = "ignored_field"
    """A frontmatter field Phoenix does not honor was present."""

    FETCH_FAILED = "fetch_failed"
    """A remote source could not be fetched; any cached copy is used instead."""


@dataclass(frozen=True)
class SkillDiagnostic:
    """A single non-fatal finding from loading external skills.

    Attributes:
        code: Machine-readable reason.
        message: Human-readable detail, safe to log.
        source: The configured source the finding came from, when known.
        skill_name: The skill involved, when known.
    """

    code: SkillDiagnosticCode
    message: str
    source: str | None = None
    skill_name: str | None = None

    def __str__(self) -> str:
        location = " ".join(
            part
            for part in (
                f"source={self.source}" if self.source else "",
                f"skill={self.skill_name}" if self.skill_name else "",
            )
            if part
        )
        suffix = f" ({location})" if location else ""
        return f"[{self.code.value}] {self.message}{suffix}"


def log_diagnostics(diagnostics: list[SkillDiagnostic]) -> None:
    """Emit ``diagnostics`` as warnings.

    Everything here is a skipped or adjusted skill rather than a failure, so these are
    warnings: the server is expected to keep running.
    """
    for diagnostic in diagnostics:
        logger.warning("External skill: %s", diagnostic)
