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

_ALL_SKILLS: tuple[Skill, ...] = (
    DEBUG_TRACE_SKILL,
    ANNOTATE_SPANS_SKILL,
    SPAN_CODING_SKILL,
    PHOENIX_GRAPHQL_SKILL,
    PLAYGROUND_SKILL,
    DATASETS_SKILL,
    EXPERIMENTS_SKILL,
    EVALUATORS_SKILL,
)


def get_all_skills() -> list[Skill]:
    """Return every skill the agent can load, in a fixed order.

    The catalog the agent sees does not depend on what the user is looking at.
    It is rendered into the static instructions, which sit in the provider's
    cacheable prefix ahead of every message in the conversation; a catalog that
    grew or shrank as the user navigated would rewrite that prefix and discard
    the cached work for the whole conversation behind it.

    The cost is a handful of always-present catalog entries and the possibility
    that a loaded skill names a tool the current surface does not advertise —
    the skill says so, and the model recovers. Gating tool *definitions* is a
    separate question from gating the catalog.
    """
    return list(_ALL_SKILLS)


def build_skills(
    *,
    include_playground: bool = False,
    include_datasets: bool = False,
    include_experiments: bool = False,
    include_evaluators: bool = False,
) -> list[Skill]:
    """Return the subset of skills matching the given inclusion flags.

    Preview-only: see :func:`get_skills`. The agent itself always receives
    :func:`get_all_skills`.
    """
    skills = [
        DEBUG_TRACE_SKILL,
        ANNOTATE_SPANS_SKILL,
        SPAN_CODING_SKILL,
        PHOENIX_GRAPHQL_SKILL,
    ]
    if include_playground:
        skills.append(PLAYGROUND_SKILL)
    if include_datasets:
        skills.append(DATASETS_SKILL)
    if include_experiments:
        skills.append(EXPERIMENTS_SKILL)
    if include_evaluators:
        skills.append(EVALUATORS_SKILL)
    return skills


def get_skills(
    *,
    has_playground_context: bool = False,
    has_dataset_context: bool = False,
    has_llm_evaluator_context: bool = False,
    has_code_evaluator_context: bool = False,
) -> list[Skill]:
    """Return the skills worth *surfacing* for a set of mounted UI contexts.

    This drives the prompt UI's slash-command picker only: it narrows a long
    list to the ones likely to be relevant to what the user is looking at. It
    is not a capability boundary — the agent is advertised every skill in
    :func:`get_all_skills` and ``load_skill`` will load any of them, whether or
    not this function would have listed it.

    Args:
        has_playground_context: Whether a playground instance is mounted.
        has_dataset_context: Whether a dataset is mounted.
        has_llm_evaluator_context: Whether an LLM evaluator is mounted.
        has_code_evaluator_context: Whether a code evaluator is mounted.

    Returns:
        The ordered list of skills to offer for the given flags.
    """
    return build_skills(
        include_playground=has_playground_context,
        include_datasets=has_dataset_context,
        include_experiments=has_dataset_context,
        include_evaluators=(
            has_dataset_context or has_llm_evaluator_context or has_code_evaluator_context
        ),
    )


__all__ = [
    "build_skills",
    "get_all_skills",
    "get_skills",
]
