"""Pure parsing and validation helpers for SKILL.md files.

These functions have no dependency on types.py or local.py, making them safe
to import from types.py without creating circular imports.
"""

from __future__ import annotations

import re
import warnings
from typing import Any

import yaml

# agentskills.io naming convention: lowercase letters, numbers, and hyphens only
# (no consecutive hyphens).
SKILL_NAME_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
RESERVED_WORDS = {"anthropic", "claude"}


def parse_skill_md(content: str) -> tuple[dict[str, Any], str]:
    """Parse a SKILL.md file into frontmatter and instructions.

    Args:
        content: Full content of the SKILL.md file.

    Returns:
        Tuple of (frontmatter_dict, instructions_markdown).

    Raises:
        ValueError: If YAML parsing fails or frontmatter is not a mapping.
    """
    lines = content.split("\n")

    # Frontmatter must open at line 0
    if not lines or lines[0].rstrip() != "---":
        return {}, content.strip()

    # Linear scan for the closing --- (no backtracking risk)
    closing_idx: int | None = None
    for i in range(1, len(lines)):
        if lines[i].rstrip() == "---":
            closing_idx = i
            break

    if closing_idx is None:
        return {}, content.strip()

    frontmatter_yaml = "\n".join(lines[1:closing_idx]).strip()
    instructions = "\n".join(lines[closing_idx + 1 :]).strip()

    if not frontmatter_yaml:
        return {}, instructions

    try:
        frontmatter = yaml.safe_load(frontmatter_yaml)
    except yaml.YAMLError as e:
        raise ValueError(f"Failed to parse YAML frontmatter: {e}") from e

    if not isinstance(frontmatter, dict):
        raise ValueError(f"YAML frontmatter must be a mapping, got {type(frontmatter).__name__}")
    return frontmatter, instructions


def _validate_name_format(name: str, location: str) -> bool:
    """Validate skill name format and emit warnings. Returns False if any check fails."""
    is_valid = True
    if len(name) > 64:
        warnings.warn(
            f"Skill name '{name}'{location} exceeds 64 characters "
            f"({len(name)} chars) recommendation. Consider shortening it.",
            UserWarning,
            stacklevel=3,
        )
        is_valid = False
    elif not SKILL_NAME_PATTERN.match(name):
        warnings.warn(
            f"Skill name '{name}'{location} should contain only lowercase letters, "
            "numbers, and hyphens",
            UserWarning,
            stacklevel=3,
        )
        is_valid = False
    for reserved in RESERVED_WORDS:
        if reserved in name:
            warnings.warn(
                f"Skill name '{name}'{location} contains reserved word '{reserved}'",
                UserWarning,
                stacklevel=3,
            )
            is_valid = False
    return is_valid


def validate_skill_metadata(
    frontmatter: dict[str, Any],
    instructions: str,
    uri: str | None = None,
) -> bool:
    """Validate skill metadata against Anthropic's requirements.

    Emits warnings for any validation issues found.

    Args:
        frontmatter: Parsed YAML frontmatter.
        instructions: The skill instructions content.
        uri: Optional URI or path identifying the skill source for diagnostics.

    Returns:
        True if validation passed with no issues, False if warnings were emitted.
    """
    is_valid = True
    # Coerce to str — YAML values may be int/list/None for pathological frontmatter
    name = str(frontmatter.get("name") or "")
    description = str(frontmatter.get("description") or "")
    compatibility = str(frontmatter.get("compatibility") or "")
    location = f" ({uri})" if uri else ""

    if not description:
        warnings.warn(
            f"Skill '{name}'{location}: missing recommended 'description' field",
            UserWarning,
            stacklevel=2,
        )
        is_valid = False

    if name and not _validate_name_format(name, location):
        is_valid = False

    if description and len(description) > 1024:
        warnings.warn(
            f"Skill '{name}'{location}: description exceeds 1024 characters "
            f"({len(description)} chars)",
            UserWarning,
            stacklevel=2,
        )
        is_valid = False

    if compatibility and len(compatibility) > 500:
        warnings.warn(
            f"Skill '{name}'{location}: compatibility exceeds 500 characters "
            f"({len(compatibility)} chars)",
            UserWarning,
            stacklevel=2,
        )
        is_valid = False

    line_count = len(instructions.split("\n"))
    if line_count > 500:
        warnings.warn(
            f"Skill '{name}'{location}: SKILL.md body exceeds recommended 500 lines "
            f"({line_count} lines). Consider splitting into separate resource files.",
            UserWarning,
            stacklevel=2,
        )
        is_valid = False

    return is_valid
