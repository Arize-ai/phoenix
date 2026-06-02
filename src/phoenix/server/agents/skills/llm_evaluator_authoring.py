from __future__ import annotations

from pathlib import Path

from phoenix.server.agents.capabilities.skills import Skill

_SKILL_PATH = (
    Path(__file__).resolve().parent.parent
    / "prompts"
    / "skills"
    / "llm-evaluator-authoring"
    / "SKILL.md"
)

LLM_EVALUATOR_AUTHORING_SKILL = Skill.from_file(_SKILL_PATH)
