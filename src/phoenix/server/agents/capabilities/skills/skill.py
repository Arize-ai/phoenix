from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from phoenix.server.agents.capabilities.skills.parsing import parse_skill_md
from phoenix.server.agents.capabilities.skills.skill_resource import SkillResource


@dataclass
class Skill:
    """A skill instance with metadata, content, and resources."""

    name: str
    description: str
    content: str
    path: Path
    resources: list[SkillResource] = field(default_factory=list)
    metadata: dict[str, Any] | None = None

    @classmethod
    def from_file(
        cls,
        path: Path,
        *,
        resources: list[SkillResource] | None = None,
    ) -> Skill:
        skill_file = path.expanduser().resolve()
        if skill_file.name != "SKILL.md":
            raise ValueError(f"Expected a SKILL.md file, got '{skill_file.name}'")

        if not skill_file.exists():
            raise FileNotFoundError(f"SKILL.md not found at {skill_file}")

        skill_folder = skill_file.parent
        raw = skill_file.read_text(encoding="utf-8")
        frontmatter, instructions = parse_skill_md(raw)

        name = frontmatter.get("name")
        if not name:
            raise ValueError(f'Skill at {skill_file} is missing the required "name" field')

        description = frontmatter.get("description") or ""
        metadata = {
            key: value for key, value in frontmatter.items() if key not in ("name", "description")
        }

        return cls(
            name=name,
            description=description,
            content=instructions,
            path=skill_folder,
            resources=resources or [],
            metadata=metadata or None,
        )
