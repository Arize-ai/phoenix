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

NAME = "create_dataset_label"

DESCRIPTION = (
    "Create a new dataset label and, by default, attach it to the dataset the user is viewing. A "
    "label is a tag used to organize and find datasets. Label names are unique across this "
    "Phoenix instance; if the name is taken the call fails and you should pick a different name. "
    "To attach a label that already exists, use set_dataset_labels instead."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "minLength": 1,
            "description": "A unique name for the new label.",
        },
        "description": {
            "type": ["string", "null"],
            "description": "An optional description of the label.",
        },
        "color": {
            "type": ["string", "null"],
            "description": (
                "An optional hex color for the label (e.g. #33c5e8). Omit for a default."
            ),
        },
        "attachToDataset": {
            "type": "boolean",
            "description": (
                "Whether to attach the new label to the dataset in view. Defaults to true."
            ),
        },
    },
    "required": ["name"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class CreateDatasetLabelCapability(AbstractDynamicCapability[AgentDependencies]):
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
