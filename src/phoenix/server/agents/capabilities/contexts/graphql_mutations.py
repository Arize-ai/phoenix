from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies


@dataclass
class GraphQLMutationsCapability(AbstractDynamicCapability[AgentDependencies]):
    """Always included so the model knows whether GraphQL mutations are available.

    The per-run callable picks the ENABLED text when a ``GraphQLContext`` is
    present and reports ``mutations_enabled=True``; otherwise it returns the
    DISABLED text — the safe default when the context is absent.
    """

    enabled_instructions: str
    disabled_instructions: str

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        enabled = self.enabled_instructions
        disabled = self.disabled_instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            graphql = ctx.deps.contexts.graphql
            if graphql is not None and graphql.mutations_enabled:
                return enabled
            return disabled

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return True
