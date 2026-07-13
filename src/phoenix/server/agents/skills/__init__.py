from __future__ import annotations

from phoenix.server.agents.capabilities.skills import Skill
from phoenix.server.agents.context import ResolvedContexts
from phoenix.server.agents.skills.annotate_spans import ANNOTATE_SPANS_SKILL
from phoenix.server.agents.skills.datasets import DATASETS_SKILL
from phoenix.server.agents.skills.debug_trace import DEBUG_TRACE_SKILL
from phoenix.server.agents.skills.evaluators import EVALUATORS_SKILL
from phoenix.server.agents.skills.experiments import EXPERIMENTS_SKILL
from phoenix.server.agents.skills.phoenix_graphql import PHOENIX_GRAPHQL_SKILL
from phoenix.server.agents.skills.playground import PLAYGROUND_SKILL
from phoenix.server.agents.skills.span_coding import SPAN_CODING_SKILL


def build_skills(
    *,
    include_playground: bool = False,
    include_datasets: bool = False,
    include_experiments: bool = False,
    include_evaluators: bool = False,
) -> list[Skill]:
    """Return the skills bundled with the assistant agent."""
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


def get_skills_for_contexts(contexts: ResolvedContexts) -> list[Skill]:
    """Return the skills the assistant agent would have given a resolved context set.

    This is the single source of truth for context-gated skill availability. Both
    the chat run (which constructs the live toolset) and the GraphQL availability
    query (which previews the catalog for the prompt UI) call through here so the
    list shown to the user matches the list the agent actually receives.

    Args:
        contexts: The resolved per-turn context set for the request.

    Returns:
        The ordered list of skills available for the given contexts.
    """
    return get_skills(
        has_playground_context=contexts.playground is not None,
        has_dataset_context=contexts.dataset is not None,
        has_llm_evaluator_context=contexts.llm_evaluator is not None,
        has_code_evaluator_context=contexts.code_evaluator is not None,
    )


def get_skills(
    *,
    has_playground_context: bool = False,
    has_dataset_context: bool = False,
    has_llm_evaluator_context: bool = False,
    has_code_evaluator_context: bool = False,
) -> list[Skill]:
    """Return the skills available given context-presence flags.

    The flag-based entry point used when a full ``ResolvedContexts`` is not
    available (e.g. the GraphQL availability query, which only knows which UI
    contexts are mounted, not their resolved contents).

    Args:
        has_playground_context: Whether a playground instance is mounted.
        has_dataset_context: Whether a dataset is mounted.
        has_llm_evaluator_context: Whether an LLM evaluator is mounted.
        has_code_evaluator_context: Whether a code evaluator is mounted.

    Returns:
        The ordered list of skills available for the given flags.
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
    "get_skills",
    "get_skills_for_contexts",
]
