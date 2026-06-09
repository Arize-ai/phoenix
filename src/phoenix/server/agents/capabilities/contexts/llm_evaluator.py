from __future__ import annotations

from dataclasses import dataclass

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies


@dataclass
class LlmEvaluatorContextCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str | None:
            llm_evaluator = ctx.deps.contexts.llm_evaluator
            if llm_evaluator is None:
                return None
            return instructions.render(
                llm_evaluator=llm_evaluator,
                edit_permission=ctx.deps.edit_permission,
                can_edit_draft=(
                    not ctx.deps.is_viewer
                    and (
                        llm_evaluator.evaluator_node_id is not None
                        or ctx.deps.model_provider_availability.has_usable
                    )
                ),
                can_test_draft=(
                    not ctx.deps.is_viewer and ctx.deps.model_provider_availability.has_usable
                ),
                is_viewer=ctx.deps.is_viewer,
            )

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.llm_evaluator is not None
