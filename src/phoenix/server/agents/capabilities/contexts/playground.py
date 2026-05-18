from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies


@dataclass
class PlaygroundContextCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: str

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str | None:
            playground = ctx.deps.contexts.playground
            if playground is None:
                return None
            if playground.instance_ids:
                lines = [
                    f'    <instance label="{chr(65 + index)}" instance_id="{instance_id}"/>'
                    for index, instance_id in enumerate(playground.instance_ids)
                ]
                instance_elements = "\n" + "\n".join(lines) + "\n  "
            else:
                instance_elements = ""
            return instructions.format(instance_elements=instance_elements)

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
