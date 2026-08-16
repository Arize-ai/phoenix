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

NAME = "patch_dataset_examples"

DESCRIPTION = (
    "Edit existing rows of the dataset the user is viewing. Each patch targets a row by id and "
    "updates its input, output, and/or metadata; omitted fields on a patch are left unchanged. "
    "This creates a new dataset version. Get row ids from list_dataset_examples. To add rows use "
    "add_dataset_examples; to remove rows use delete_dataset_examples."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "patches": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "properties": {
                    "exampleId": {
                        "type": "string",
                        "minLength": 1,
                        "description": "The id of the row to edit (from list_dataset_examples).",
                    },
                    "input": {"type": "object", "description": "New input object for the row."},
                    "output": {"type": "object", "description": "New output object for the row."},
                    "metadata": {
                        "type": "object",
                        "description": "New metadata object for the row.",
                    },
                },
                "required": ["exampleId"],
                "additionalProperties": False,
            },
            "description": "The row edits to apply.",
        },
        "versionDescription": {
            "type": ["string", "null"],
            "description": "An optional note describing the new dataset version.",
        },
    },
    "required": ["patches"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class PatchDatasetExamplesCapability(AbstractDynamicCapability[AgentDependencies]):
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
