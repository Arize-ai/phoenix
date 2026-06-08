from __future__ import annotations

from phoenix.server.agents.capabilities.skills import Skill
from phoenix.server.agents.context import ResolvedContexts
from phoenix.server.agents.skills.annotate_spans import ANNOTATE_SPANS_SKILL
from phoenix.server.agents.skills.debug_trace import DEBUG_TRACE_SKILL
from phoenix.server.agents.skills.llm_evaluator_authoring import LLM_EVALUATOR_AUTHORING_SKILL
from phoenix.server.agents.skills.playground import PLAYGROUND_SKILL


def build_skills(
    *,
    include_playground: bool = False,
    include_llm_evaluator_authoring: bool = False,
) -> list[Skill]:
    """Return the skills bundled with the assistant agent."""
    skills = [DEBUG_TRACE_SKILL, ANNOTATE_SPANS_SKILL]
    if include_playground:
        skills.append(PLAYGROUND_SKILL)
    if include_llm_evaluator_authoring:
        skills.append(LLM_EVALUATOR_AUTHORING_SKILL)
    return skills


def select_skills_for_contexts(contexts: ResolvedContexts) -> list[Skill]:
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
    return select_skills(
        has_playground_context=contexts.playground is not None,
        has_dataset_context=contexts.dataset is not None,
        has_llm_evaluator_context=contexts.llm_evaluator is not None,
    )


def select_skills(
    *,
    has_playground_context: bool = False,
    has_dataset_context: bool = False,
    has_llm_evaluator_context: bool = False,
) -> list[Skill]:
    """Return the skills available given context-presence flags.

    The flag-based entry point used when a full ``ResolvedContexts`` is not
    available (e.g. the GraphQL availability query, which only knows which UI
    contexts are mounted, not their resolved contents).

    Args:
        has_playground_context: Whether a playground instance is mounted.
        has_dataset_context: Whether a dataset is mounted.
        has_llm_evaluator_context: Whether an LLM evaluator is mounted.

    Returns:
        The ordered list of skills available for the given flags.
    """
    return build_skills(
        include_playground=has_playground_context,
        include_llm_evaluator_authoring=has_dataset_context or has_llm_evaluator_context,
    )


__all__ = ["build_skills", "select_skills", "select_skills_for_contexts"]
