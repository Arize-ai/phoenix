from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "list_labels"

DESCRIPTION = (
    "List the dataset labels that exist across this Phoenix instance, returning each label's id, "
    "name, description, and color. Read-only. A label is a tag you can attach to datasets to "
    "organize and find them (filter datasets with list_datasets, or apply with "
    "set_dataset_labels). Paginate with limit/after. For just the labels on the dataset in view, "
    "use list_dataset_labels."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 50,
            "description": "Maximum number of labels to return per page (default 20).",
        },
        "after": {
            "type": ["string", "null"],
            "description": (
                "Pagination cursor. Pass the endCursor from a previous call to get the next "
                "page; omit or null for the first page."
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
class ListLabelsCapability(AbstractStaticCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_static_instructions(self) -> str:
        return self.instructions.render()
