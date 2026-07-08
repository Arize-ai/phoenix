from __future__ import annotations

from dataclasses import dataclass
from string import ascii_uppercase

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies


@dataclass
class PlaygroundContextCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str | None:
            playground = ctx.deps.contexts.playground
            if playground is None:
                return None
            return instructions.render(
                playground=playground.model_dump(by_alias=False),
                dataset=ctx.deps.contexts.dataset,
                edit_permission=ctx.deps.edit_permission,
                labels=ascii_uppercase,
            )

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
