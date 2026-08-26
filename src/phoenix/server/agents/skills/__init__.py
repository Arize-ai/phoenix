from __future__ import annotations

from phoenix.server.agents.capabilities.skills import Skill
from phoenix.server.agents.skills.annotate_spans import ANNOTATE_SPANS_SKILL
from phoenix.server.agents.skills.datasets import DATASETS_SKILL
from phoenix.server.agents.skills.debug_trace import DEBUG_TRACE_SKILL
from phoenix.server.agents.skills.evaluators import EVALUATORS_SKILL
from phoenix.server.agents.skills.experiments import EXPERIMENTS_SKILL
from phoenix.server.agents.skills.phoenix_graphql import PHOENIX_GRAPHQL_SKILL
from phoenix.server.agents.skills.playground import PLAYGROUND_SKILL
from phoenix.server.agents.skills.span_coding import SPAN_CODING_SKILL


def get_skills() -> list[Skill]:
    """Return every skill, in a fixed order."""
    return [
        DEBUG_TRACE_SKILL,
        ANNOTATE_SPANS_SKILL,
        SPAN_CODING_SKILL,
        PHOENIX_GRAPHQL_SKILL,
        PLAYGROUND_SKILL,
        DATASETS_SKILL,
        EXPERIMENTS_SKILL,
        EVALUATORS_SKILL,
    ]


__all__ = [
    "get_skills",
]
