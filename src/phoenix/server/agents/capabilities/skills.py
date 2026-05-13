from __future__ import annotations

from pathlib import Path

from pydantic_ai_skills import SkillsCapability

_SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"
assert _SKILLS_DIR.parts[-4:] == ("phoenix", "server", "agents", "skills")


def build_skills_capability() -> SkillsCapability:
    return SkillsCapability(directories=[_SKILLS_DIR])
