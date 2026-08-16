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

NAME = "set_dataset_example_splits"

DESCRIPTION = (
    "Assign rows of the dataset the user is viewing to one or more existing splits, by split name. "
    "This SETS each row's splits to exactly the named splits — it replaces whatever splits those "
    "rows were in. The splits must already exist on the dataset; to create a new split use "
    "create_dataset_split. Get example ids from list_dataset_examples and split names from "
    "list_dataset_splits."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "exampleIds": {
            "type": "array",
            "minItems": 1,
            "items": {"type": "string", "minLength": 1},
            "description": "The ids of the rows to assign (from list_dataset_examples).",
        },
        "splitNames": {
            "type": "array",
            "minItems": 1,
            "items": {"type": "string", "minLength": 1},
            "description": (
                "The names of the existing splits to set the rows to (from list_dataset_splits). "
                "Each row's split membership is replaced with exactly these splits."
            ),
        },
    },
    "required": ["exampleIds", "splitNames"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SetDatasetExampleSplitsCapability(AbstractDynamicCapability[AgentDependencies]):
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
