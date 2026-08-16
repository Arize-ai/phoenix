from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc, ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset
from typing_extensions import override

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "add_dataset_examples"

DESCRIPTION = (
    "Append one or more new examples to the dataset the user is currently viewing. Each example "
    "has an input object and optional output and metadata objects. This adds rows to the dataset "
    "in view; it does not create a new dataset or edit existing rows. Show the user the rows you "
    "intend to add and get a go-ahead first — the change is applied when you call the tool."
)

_EXAMPLE_ITEM: dict[str, Any] = {
    "type": "object",
    "properties": {
        "input": {
            "type": "object",
            "description": (
                "The example's input object — the fields the app or prompt consumes. Match the "
                "field names and shape of the dataset's existing rows."
            ),
        },
        "output": {
            "type": "object",
            "description": (
                "Optional reference output. Omit for an input-only row. Treat this as a reference, "
                "not necessarily the correct answer."
            ),
        },
        "metadata": {
            "type": "object",
            "description": "Optional metadata object for the row.",
        },
    },
    "required": ["input"],
    "additionalProperties": False,
}

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "examples": {
            "type": "array",
            "minItems": 1,
            "description": "The rows to append to the dataset in view.",
            "items": _EXAMPLE_ITEM,
        },
    },
    "required": ["examples"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class AddDatasetExamplesCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    @override
    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    @override
    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Writes are blocked server-side for viewers; don't advertise to them.
        return ctx.deps.contexts.dataset is not None and not ctx.deps.is_viewer
