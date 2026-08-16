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

NAME = "delete_dataset_labels"

DESCRIPTION = (
    "Delete dataset labels, identified by name. This removes each label entirely (across the "
    "instance), detaching it from every dataset it was on; the datasets themselves are not "
    "deleted. To remove a label from this dataset without deleting the label, use "
    "set_dataset_labels. Get label names from list_dataset_labels."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "labelNames": {
            "type": "array",
            "minItems": 1,
            "items": {"type": "string", "minLength": 1},
            "description": "The names of the labels to delete (from list_dataset_labels).",
        },
    },
    "required": ["labelNames"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class DeleteDatasetLabelsCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Writes are blocked server-side for viewers; don't advertise to them.
        return ctx.deps.contexts.dataset is not None and not ctx.deps.is_viewer
