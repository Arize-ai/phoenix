from __future__ import annotations

from phoenix.server.agents.capabilities.skills import Skill
from phoenix.server.agents.skills.annotate_spans import ANNOTATE_SPANS_SKILL
from phoenix.server.agents.skills.debug_trace import DEBUG_TRACE_SKILL
from phoenix.server.agents.skills.playground import PLAYGROUND_SKILL


def build_skills(*, include_playground: bool = False) -> list[Skill]:
    """Return the skills bundled with the PXI agent."""
    skills = [DEBUG_TRACE_SKILL, ANNOTATE_SPANS_SKILL]
    if include_playground:
        skills.append(PLAYGROUND_SKILL)
    return skills


__all__ = ["build_skills"]
