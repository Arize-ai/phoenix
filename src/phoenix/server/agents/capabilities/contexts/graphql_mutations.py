from __future__ import annotations

from dataclasses import dataclass

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies


@dataclass
class GraphQLMutationsCapability(AbstractDynamicCapability[AgentDependencies]):
    """Always included so the model knows whether GraphQL mutations are available."""

    instructions: Template

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            graphql = ctx.deps.contexts.graphql
            enabled = graphql is not None and graphql.mutations_enabled
            return instructions.render(enabled=enabled)

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return True
