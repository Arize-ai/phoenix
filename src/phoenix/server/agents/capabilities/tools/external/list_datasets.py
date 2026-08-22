from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.types import AgentDependencies

NAME = "list_datasets"

DESCRIPTION = """\
List the datasets in this Phoenix instance, returning each dataset's id, name, and example count. Read-only. Use this to resolve the user's loose reference ("my regression set") into a specific dataset id, to check whether a name is already taken before create_dataset, or when the user asks what datasets exist. Prefer this over hand-writing GraphQL (e.g. via bash).
The name filter is a case-insensitive substring match, so it can return several datasets. When more than one could be what the user means, do not assume the first — use ask_user to confirm which dataset before acting on it.
To find datasets carrying a label, pass the label name(s) in `labelNames` (discover label names with list_labels); it can be combined with the name filter.
If the result reports more pages, call again with the returned cursor in `after` to continue."""

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
    defer_loading=True,
)


@dataclass
class ListDatasetsCapability(AbstractCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])
