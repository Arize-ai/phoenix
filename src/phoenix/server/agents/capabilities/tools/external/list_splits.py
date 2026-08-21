from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.types import AgentDependencies

NAME = "list_splits"

DESCRIPTION = """\
List the dataset splits that exist across this Phoenix instance, returning each split's id, name, description, and color. Read-only. A split is a named slice of dataset examples (e.g. train/validation/test, or by facet); splits are global, so the same split can hold examples from more than one dataset. Use this to discover what splits exist before assigning examples with set_dataset_example_splits, editing one with patch_dataset_split, or deleting one with delete_dataset_splits; for just the splits the dataset in view is using, use list_dataset_splits. Prefer this over hand-writing GraphQL.
The list is paginated: if the result reports more pages (`hasNextPage`), call again with the returned cursor in `after` before concluding a split does not exist. The set/patch/delete split tools already resolve names against the full split set.
If a split the user wants does not exist yet, create it with create_dataset_split."""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 50,
            "description": "Maximum number of splits to return per page (default 20).",
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
class ListSplitsCapability(AbstractCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])
