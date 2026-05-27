from __future__ import annotations

from phoenix.server.agents.capabilities.skills import Skill
from phoenix.server.agents.skills.trace_debugging import TRACE_DEBUGGING_SKILL


def build_skills() -> list[Skill]:
    """Return the skills bundled with the PXI agent."""
    return [TRACE_DEBUGGING_SKILL]


__all__ = ["build_skills"]
