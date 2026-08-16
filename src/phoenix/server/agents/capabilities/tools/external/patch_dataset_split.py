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

NAME = "patch_dataset_split"

DESCRIPTION = (
    "Edit an existing split of the dataset the user is viewing — its name, description, and/or "
    "color — identified by its current name. Only the fields you pass are changed. Pass "
    "description: null to clear the description; name and color cannot be cleared, only "
    "replaced with a new non-empty value. Does not change which rows are in the split (use "
    "set_dataset_example_splits for that). Get the split's current name from "
    "list_dataset_splits. Split names are unique; a duplicate new name fails."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "splitName": {
            "type": "string",
            "minLength": 1,
            "description": "The current name of the split to edit (from list_dataset_splits).",
        },
        "name": {
            "type": "string",
            "minLength": 1,
            "description": "A new unique name for the split.",
        },
        "description": {
            "type": ["string", "null"],
            "description": "A new description for the split, or null to clear it.",
        },
        "color": {
            "type": "string",
            "minLength": 1,
            "description": "A new hex color for the split (e.g. #33c5e8).",
        },
    },
    "required": ["splitName"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class PatchDatasetSplitCapability(AbstractDynamicCapability[AgentDependencies]):
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
