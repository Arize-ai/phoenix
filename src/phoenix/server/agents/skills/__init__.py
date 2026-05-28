from __future__ import annotations

from phoenix.server.agents.capabilities.skills import Skill
from phoenix.server.agents.skills.debug_trace import DEBUG_TRACE_SKILL


def build_skills() -> list[Skill]:
    """Return the skills bundled with the PXI agent."""
    return [DEBUG_TRACE_SKILL]


__all__ = ["build_skills"]
