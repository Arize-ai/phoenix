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
from phoenix.server.agents.capabilities.contexts.prompt import (
    PromptContextCapability,
    PromptVersionContextCapability,
)
from phoenix.server.agents.capabilities.contexts.session import SessionContextCapability
from phoenix.server.agents.capabilities.contexts.span import SpanContextCapability
from phoenix.server.agents.capabilities.contexts.trace import TraceContextCapability
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.types import AgentDependencies


def get_context_capability_function(
    *,
    prompts: AgentPrompts,
) -> CapabilityFunc[AgentDependencies]:
    """Return a ``CapabilityFunc`` that assembles per-run UI-context capabilities."""
    dynamic_capabilities: list[AbstractDynamicCapability[AgentDependencies]] = [
        ProjectContextCapability(instructions=prompts.project_context),
        TraceContextCapability(instructions=prompts.trace_context),
        SessionContextCapability(instructions=prompts.session_context),
        PromptContextCapability(instructions=prompts.prompt_context),
        PromptVersionContextCapability(instructions=prompts.prompt_version_context),
        SpanContextCapability(instructions=prompts.span_context),
        PlaygroundContextCapability(instructions=prompts.playground_context),
        CodeEvaluatorContextCapability(instructions=prompts.code_evaluator_context),
        LlmEvaluatorContextCapability(instructions=prompts.llm_evaluator_context),
        DatasetContextCapability(instructions=prompts.dataset_context),
        GraphQLMutationsCapability(instructions=prompts.graphql_mutations),
    ]

    def _build(ctx: RunContext[AgentDependencies]) -> AbstractCapability[AgentDependencies]:
        static_capabilities: list[AbstractCapability[AgentDependencies]] = [
            AppContextCapability(
                instructions=prompts.app_context,
                edit_permission=ctx.deps.edit_permission,
            ),
        ]
        included = [
            *static_capabilities,
            *(cap for cap in dynamic_capabilities if cap.include_for_run(ctx)),
        ]
        return CombinedCapability(capabilities=included)

    return _build


__all__ = [
    "AppContextCapability",
    "CodeEvaluatorContextCapability",
    "DatasetContextCapability",
    "GraphQLMutationsCapability",
    "LlmEvaluatorContextCapability",
    "PlaygroundContextCapability",
    "PromptContextCapability",
    "PromptVersionContextCapability",
    "ProjectContextCapability",
    "SessionContextCapability",
    "SpanContextCapability",
    "TraceContextCapability",
    "get_context_capability_function",
]
