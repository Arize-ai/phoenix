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

NAME = "load_dataset"

DESCRIPTION = (
    "Load a dataset into the currently mounted playground so the user can run prompts "
    "over it. Optionally scope the run to a single split. This tool does not switch the "
    "playground immediately: the browser renders an inline accept/reject card and the "
    "user must approve the change. Pass dataset and split names exactly as they appear in "
    "Phoenix; the browser resolves the names to IDs. Use this when the user asks to load, "
    "open, switch to, or run against a dataset (or a split of one) in the playground."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "datasetName": {
            "type": "string",
            "minLength": 1,
            "description": "The name of the dataset to load, exactly as it appears in Phoenix.",
        },
        "splitName": {
            "type": ["string", "null"],
            "description": (
                "The name of a single dataset split to scope the run to, exactly as it "
                "appears in Phoenix. Use null or omit to load the whole dataset."
            ),
        },
    },
    "required": ["datasetName"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class LoadDatasetCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
