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

NAME = "create_dataset"

DESCRIPTION = (
    "Create a new dataset, optionally seeded with starting rows. Each starting example has an "
    "input object and optional output and metadata objects. Dataset names are unique; if the name "
    "is already taken the call fails and you should pick a different name. To add rows to a "
    "dataset that already exists, use add_dataset_examples instead."
)

_EXAMPLE_ITEM: dict[str, Any] = {
    "type": "object",
    "properties": {
        "input": {
            "type": "object",
            "description": "The example's input object (the fields the app or prompt consumes).",
        },
        "output": {
            "type": "object",
            "description": (
                "Optional reference output. Omit for an input-only row. Treat this as a reference, "
                "not necessarily the correct answer."
            ),
        },
        "metadata": {"type": "object", "description": "Optional metadata object for the row."},
    },
    "required": ["input"],
    "additionalProperties": False,
}

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "minLength": 1,
            "description": "A unique name for the new dataset.",
        },
        "description": {
            "type": ["string", "null"],
            "description": "An optional description of the dataset.",
        },
        "examples": {
            "type": "array",
            "description": "Optional starting rows to seed the dataset with.",
            "items": _EXAMPLE_ITEM,
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
class CreateDatasetCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Creating a dataset has no context to gate on, but the write is blocked
        # server-side for viewers, so don't advertise it to them.
        return not ctx.deps.is_viewer
