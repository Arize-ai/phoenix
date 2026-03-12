"""Generic semantic version utilities.

Provides a ``SemanticVersion`` type alias, parsing, comparison, and
formatting helpers that are not tied to any specific versioned system.
"""

from __future__ import annotations

from typing import Optional, Tuple

SemanticVersion = Tuple[int, int, int]


def parse_semantic_version(raw: str) -> Optional[SemanticVersion]:
    """Parse a version string like ``'1.2.3'`` into a ``(1, 2, 3)`` tuple.

    Returns ``None`` if the string cannot be parsed.
    """
    try:
        parts = raw.strip().split(".")
        if len(parts) >= 3:
            return (int(parts[0]), int(parts[1]), int(parts[2]))
    except (ValueError, IndexError):
        pass
    return None


def satisfies_min_version(version: SemanticVersion, min_version: SemanticVersion) -> bool:
    """Return ``True`` if *version* is ``>=`` *min_version*."""
    return version >= min_version


def format_version(version: SemanticVersion) -> str:
    """Format a ``SemanticVersion`` tuple as a ``'major.minor.patch'`` string."""
    return f"{version[0]}.{version[1]}.{version[2]}"
