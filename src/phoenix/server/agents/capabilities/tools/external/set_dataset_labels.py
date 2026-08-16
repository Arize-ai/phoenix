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

NAME = "set_dataset_labels"

DESCRIPTION = (
    "Set the labels on the dataset the user is viewing, by label name. This SETS the dataset's "
    "labels to exactly the named labels — it replaces whatever labels were on it. The labels must "
    "already exist; to create a new label use create_dataset_label. Get label names from "
    "list_dataset_labels."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "labelNames": {
            "type": "array",
            "minItems": 1,
            "items": {"type": "string", "minLength": 1},
            "description": (
                "The names of the existing labels to set on the dataset (from "
                "list_dataset_labels). The dataset's labels are replaced with exactly these."
            ),
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
class SetDatasetLabelsCapability(AbstractDynamicCapability[AgentDependencies]):
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
