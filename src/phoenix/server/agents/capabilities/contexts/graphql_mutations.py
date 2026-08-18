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
            enabled = ctx.deps.contexts.graphql_mutations_enabled
            approval_required = enabled and ctx.deps.edit_permission == "manual"
            return instructions.render(enabled=enabled, approval_required=approval_required)

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return True
