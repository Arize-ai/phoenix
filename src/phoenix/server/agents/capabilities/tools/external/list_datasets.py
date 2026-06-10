from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "list_datasets"

DESCRIPTION = (
    "List the datasets in this Phoenix instance, returning each dataset's id, name, and example "
    "count. Read-only. Filter by a case-insensitive substring of the name and/or by label names, "
    "and paginate with a cursor. Use this to resolve which dataset the user means and to check "
    "whether a name is already taken before creating one. Prefer this over hand-writing GraphQL."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "nameContains": {
            "type": "string",
            "minLength": 1,
            "description": (
                "Case-insensitive substring to filter dataset names by. Omit to list all "
                "datasets. May match more than one dataset."
            ),
        },
        "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 50,
            "description": "Maximum number of datasets to return (default 20).",
        },
        "after": {
            "type": ["string", "null"],
            "description": (
                "Pagination cursor. Pass the endCursor from a previous call to get the next "
                "page; omit or null for the first page."
            ),
        },
        "labelNames": {
            "type": "array",
            "items": {"type": "string", "minLength": 1},
            "description": (
                "Optional label names to filter by; only datasets carrying any of these labels "
                "are returned. Combine with nameContains to narrow further."
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
class ListDatasetsCapability(AbstractStaticCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_static_instructions(self) -> str:
        return self.instructions.render()
