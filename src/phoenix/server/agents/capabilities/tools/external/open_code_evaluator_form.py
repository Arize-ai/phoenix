from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc, ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "open_code_evaluator_form"

DESCRIPTION = (
    "Open the dataset-backed code-evaluator form from the current playground "
    "without navigating away. Use this when a dataset is mounted in the playground "
    "and the user wants to author a code evaluator. This opens the existing "
    "create-code-evaluator form; it does not persist or create an evaluator."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {},
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class OpenCodeEvaluatorFormCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return (
            ctx.deps.contexts.playground is not None
            and ctx.deps.contexts.dataset is not None
            and ctx.deps.contexts.code_evaluator is None
            and ctx.deps.sandbox_availability.has_usable
            and not ctx.deps.is_viewer
        )
