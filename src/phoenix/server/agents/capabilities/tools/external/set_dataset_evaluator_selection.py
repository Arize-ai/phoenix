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

NAME = "set_dataset_evaluator_selection"

DESCRIPTION = (
    "Set which existing dataset evaluators are applied to the mounted playground "
    "so they run in the next experiment. Use this when the user wants to choose, "
    "add, or remove which evaluators score the dataset. Pass the complete desired "
    "set of evaluator ids from the playground roster; this replaces the current "
    "selection wholesale. It does not create, edit, or delete evaluators."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "datasetEvaluatorIds": {
            "type": "array",
            "description": (
                "Complete desired set of dataset evaluator ids to apply, taken "
                "from the playground roster. Pass an empty array to clear the "
                "selection so no evaluators run."
            ),
            "items": {"type": "string", "minLength": 1},
        },
    },
    "required": ["datasetEvaluatorIds"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SetDatasetEvaluatorSelectionCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Empty roster is intentionally gated out: the applied set is already filtered to
        # roster membership at run time (PlaygroundDatasetSection), so empty-array "clear"
        # is moot here.
        playground = ctx.deps.contexts.playground
        return (
            playground is not None
            and ctx.deps.contexts.dataset is not None
            and bool(playground.evaluators)
            and not ctx.deps.is_viewer
        )
