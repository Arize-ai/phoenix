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
            return instructions.render(
                dataset=dataset,
                is_code_evaluator_surface=code_evaluator is not None,
                has_usable_sandbox=ctx.deps.sandbox_availability.has_usable,
                is_viewer=ctx.deps.is_viewer,
                can_open_experiment_evaluator_form=(
                    ctx.deps.contexts.playground is not None
                    and code_evaluator is None
                    and ctx.deps.sandbox_availability.has_usable
                    and not ctx.deps.is_viewer
                ),
                can_edit_code_evaluator_draft=(
                    code_evaluator is not None
                    and not ctx.deps.is_viewer
                    and (
                        code_evaluator.evaluator_node_id is not None
                        or ctx.deps.sandbox_availability.has_usable
                    )
                ),
                can_test_code_evaluator_draft=(
                    code_evaluator is not None
                    and ctx.deps.sandbox_availability.has_usable
                    and not ctx.deps.is_viewer
                ),
                dataset_example_samples=ctx.deps.dataset_example_samples.samples,
            )

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.dataset is not None
