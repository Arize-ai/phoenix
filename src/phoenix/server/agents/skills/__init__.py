"""Bundled skills shipped with the PXI agent.

The SKILL.md files themselves live under
``phoenix.server.agents.prompts.skills``; this module imports them and
constructs the corresponding ``Skill`` objects.
"""

from __future__ import annotations

from pathlib import Path

from phoenix.server.agents.capabilities.skills import Skill

_PROMPTS_SKILLS_DIR = Path(__file__).resolve().parent.parent / "prompts" / "skills"

_TRACE_DEBUGGING_SKILL = Skill.from_file(_PROMPTS_SKILLS_DIR / "trace-debugging" / "SKILL.md")


def build_skills() -> list[Skill]:
    """Return the skills bundled with the PXI agent."""
    return [_TRACE_DEBUGGING_SKILL]


__all__ = ["build_skills"]
