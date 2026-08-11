"""Validation for skills loaded from directories Phoenix does not control.

First-party skills are reviewed in this repo; external ones are not. Everything here
exists because an external skill can be malformed, hostile, or simply written against
a different agent's conventions.

Two of these checks replace protections lost when skills moved onto the filesystem:
the body is now read with ``cat`` rather than rendered through a truncating Jinja
filter, so the size cap has to be enforced at load time instead of at read time.
"""

from __future__ import annotations

import re
from pathlib import Path

NAME_MAX_CHARS = 64
DESCRIPTION_MAX_CHARS = 1024
BODY_MAX_BYTES = 256 * 1024

_NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
"""Agent Skills slug: lowercase alphanumerics in hyphen-separated groups.

Consecutive hyphens, leading and trailing hyphens, uppercase, and dots are all
rejected by construction, which also rules out `.`, `..`, and hidden directories.
"""

# Frontmatter fields in the Agent Skills spec that Phoenix does not act on. Reported so
# a skill author is not left believing they took effect.
UNSUPPORTED_FIELDS = ("allowed-tools",)


def is_valid_skill_name(name: str) -> bool:
    """Return whether ``name`` is a usable skill name.

    >>> is_valid_skill_name("debug-trace")
    True
    >>> is_valid_skill_name("debug--trace")
    False
    >>> is_valid_skill_name("-debug")
    False
    >>> is_valid_skill_name("Debug")
    False
    >>> is_valid_skill_name("..")
    False
    >>> is_valid_skill_name("")
    False
    """
    return bool(name) and len(name) <= NAME_MAX_CHARS and bool(_NAME_PATTERN.match(name))


def is_safe_segment(segment: str) -> bool:
    """Return whether ``segment`` is safe to use as a single path component.

    Rejects traversal, separators, null bytes, and anything URL-like.

    >>> is_safe_segment("resources")
    True
    >>> is_safe_segment("..")
    False
    >>> is_safe_segment("a/b")
    False
    >>> is_safe_segment("https://evil")
    False
    >>> is_safe_segment("a\\x00b")
    False
    """
    if not segment or segment in (".", ".."):
        return False
    if "\x00" in segment:
        return False
    if "/" in segment or "\\" in segment:
        return False
    if "://" in segment:
        return False
    return True


def resolve_within(root: Path, candidate: Path) -> Path | None:
    """Return ``candidate`` resolved, or ``None`` if it escapes ``root``.

    Both sides are fully resolved first, so this also catches a symlink inside the
    source tree pointing somewhere outside it — the case a purely lexical check on the
    unresolved path would miss.
    """
    try:
        resolved_root = root.resolve(strict=True)
        resolved = candidate.resolve(strict=True)
    except (OSError, RuntimeError):
        return None
    if resolved != resolved_root and resolved_root not in resolved.parents:
        return None
    return resolved


def describe_invalid_name(name: str) -> str:
    """Return the reason ``name`` is unusable, for a diagnostic message."""
    if not name:
        return "skill name is missing or empty"
    if len(name) > NAME_MAX_CHARS:
        return f"skill name is {len(name)} characters, over the {NAME_MAX_CHARS} maximum"
    return (
        f"skill name {name!r} is not a valid slug: expected lowercase letters and digits "
        "in hyphen-separated groups, e.g. 'debug-trace'"
    )
