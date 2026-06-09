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

NAME = "list_dataset_examples"

DESCRIPTION = (
    "List a page of rows from the dataset the user is currently viewing, including each row's id, "
    "input, output, and metadata. Read-only. Use this to learn the dataset's shape before adding "
    "rows so new rows match, or to inspect existing content. Optionally filter to one or more "
    "splits by name, and paginate with the returned cursor. Prefer this over hand-writing GraphQL "
    "to read the dataset."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 50,
            "description": "Maximum number of rows to return (default 10).",
        },
        "after": {
            "type": ["string", "null"],
            "description": (
                "Pagination cursor. Pass the endCursor from a previous call to get the next "
                "page; omit or null for the first page."
            ),
        },
        "splitNames": {
            "type": "array",
            "items": {"type": "string", "minLength": 1},
            "description": (
                "Optional split names to filter rows by; a row is included if it belongs to any "
                "of them. Omit to read across all splits. The result lists the dataset's available "
                "split names."
            ),
        },
    },
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class ListDatasetExamplesCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.dataset is not None
