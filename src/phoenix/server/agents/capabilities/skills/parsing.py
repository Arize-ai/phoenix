from __future__ import annotations

from typing import Any, TypeAlias

import yaml

Frontmatter: TypeAlias = dict[str, Any]
SkillContent: TypeAlias = str


def parse_skill_md(content: str) -> tuple[Frontmatter, SkillContent]:
    """Parse a SKILL.md file into frontmatter and instructions."""
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
        raise ValueError(
            "SKILL.md frontmatter is missing a closing fence ('---'); "
            "expected '---' on its own line after the opening fence"
        )

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
