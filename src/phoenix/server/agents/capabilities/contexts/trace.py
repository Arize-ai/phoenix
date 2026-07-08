from __future__ import annotations

from dataclasses import dataclass

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies


@dataclass
class TraceContextCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str | None:
            trace = ctx.deps.contexts.trace
            if trace is None:
                return None
            return instructions.render(trace=trace)

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.trace is not None
