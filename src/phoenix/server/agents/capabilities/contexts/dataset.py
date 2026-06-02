from __future__ import annotations

from dataclasses import dataclass

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies


@dataclass
class DatasetContextCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str | None:
            dataset = ctx.deps.contexts.dataset
            if dataset is None:
                return None
            code_evaluator = ctx.deps.contexts.code_evaluator
            llm_evaluator = ctx.deps.contexts.llm_evaluator
            return instructions.render(
                dataset=dataset,
                is_code_evaluator_form_mounted=code_evaluator is not None,
                is_llm_evaluator_form_mounted=llm_evaluator is not None,
                has_usable_sandbox=ctx.deps.sandbox_availability.has_usable,
                has_usable_model_provider=ctx.deps.model_provider_availability.has_usable,
                is_viewer=ctx.deps.is_viewer,
            )

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.dataset is not None
