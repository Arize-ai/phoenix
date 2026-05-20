"""Pure parsing and validation helpers for SKILL.md files.

These functions have no dependency on types.py or local.py, making them safe
to import from types.py without creating circular imports.
"""

from __future__ import annotations

from typing import Any

import yaml


def parse_skill_md(content: str) -> tuple[dict[str, Any], str]:
    """Parse a SKILL.md file into frontmatter and instructions.

    Args:
        content: Full content of the SKILL.md file.

    Returns:
        Tuple of (frontmatter_dict, instructions_markdown).

    Raises:
        ValueError: If the file does not begin with a YAML frontmatter fence,
            if YAML parsing fails, or if the frontmatter is not a mapping.
    """
    lines = content.split("\n")

    # Frontmatter must open at line 0
    if not lines or lines[0].rstrip() != "---":
        raise ValueError("SKILL.md must begin with a YAML frontmatter fence ('---')")

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
