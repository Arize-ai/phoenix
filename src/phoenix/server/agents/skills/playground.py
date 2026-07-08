from __future__ import annotations

from pathlib import Path

from phoenix.server.agents.capabilities.skills import Skill

_SKILL_PATH = (
    Path(__file__).resolve().parent.parent / "prompts" / "skills" / "playground" / "SKILL.md"
)

PLAYGROUND_SKILL = Skill.from_file(_SKILL_PATH)
