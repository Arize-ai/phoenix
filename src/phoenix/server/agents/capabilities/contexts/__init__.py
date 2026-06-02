from __future__ import annotations

from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability, CapabilityFunc, CombinedCapability

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.capabilities.contexts.app import AppContextCapability
from phoenix.server.agents.capabilities.contexts.code_evaluator import (
    CodeEvaluatorContextCapability,
)
from phoenix.server.agents.capabilities.contexts.dataset import DatasetContextCapability
from phoenix.server.agents.capabilities.contexts.graphql_mutations import (
    GraphQLMutationsCapability,
)
from phoenix.server.agents.capabilities.contexts.llm_evaluator import (
    LlmEvaluatorContextCapability,
)
from phoenix.server.agents.capabilities.contexts.playground import PlaygroundContextCapability
from phoenix.server.agents.capabilities.contexts.project import ProjectContextCapability
from phoenix.server.agents.capabilities.contexts.span import SpanContextCapability
from phoenix.server.agents.capabilities.contexts.trace import TraceContextCapability
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.types import AgentDependencies


def get_context_capability_function(
    *,
    prompts: AgentPrompts,
) -> CapabilityFunc[AgentDependencies]:
    """Return a ``CapabilityFunc`` that assembles per-run UI-context capabilities.

    Each context capability self-gates via ``include_for_run`` based on the
    presence of the matching dataclass on ``ctx.deps.contexts``.
    ``GraphQLMutationsCapability`` is always included so the safe-default
    DISABLED policy ships when no GraphQL context was supplied this turn.
    """
    capabilities: list[AbstractDynamicCapability[AgentDependencies]] = [
        AppContextCapability(instructions=prompts.app_context),
        ProjectContextCapability(instructions=prompts.project_context),
        TraceContextCapability(instructions=prompts.trace_context),
        SpanContextCapability(instructions=prompts.span_context),
        PlaygroundContextCapability(instructions=prompts.playground_context),
        CodeEvaluatorContextCapability(instructions=prompts.code_evaluator_context),
        LlmEvaluatorContextCapability(instructions=prompts.llm_evaluator_context),
        DatasetContextCapability(instructions=prompts.dataset_context),
        GraphQLMutationsCapability(instructions=prompts.graphql_mutations),
    ]

    def _build(ctx: RunContext[AgentDependencies]) -> AbstractCapability[AgentDependencies]:
        included = [cap for cap in capabilities if cap.include_for_run(ctx)]
        return CombinedCapability(capabilities=included)

    return _build


__all__ = [
    "AppContextCapability",
    "CodeEvaluatorContextCapability",
    "DatasetContextCapability",
    "GraphQLMutationsCapability",
    "LlmEvaluatorContextCapability",
    "PlaygroundContextCapability",
    "ProjectContextCapability",
    "SpanContextCapability",
    "TraceContextCapability",
    "get_context_capability_function",
]
