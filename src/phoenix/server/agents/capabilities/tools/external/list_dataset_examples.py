from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "list_dataset_examples"

DESCRIPTION = """\
List a page of examples from the dataset the user is currently viewing, including each example's id, input, output, and metadata. Read-only. Use this to learn the dataset's shape before adding examples so new examples match, or to inspect existing content. Prefer this over hand-writing GraphQL queries (e.g. via bash) to read the dataset in view.
A small `limit` is usually enough to learn the shape. If the result reports more pages, call again with the returned cursor in `after`.
To read a specific split, pass its name in `splitNames`. The result lists the dataset's available split names, so read once without a filter first if you are unsure which splits exist.
Remember an output is a reference, not necessarily the correct answer."""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 50,
            "description": "Maximum number of examples to return (default 10).",
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
                "Optional split names to filter examples by; an example is included if it belongs to any "
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
class ListDatasetExamplesCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.dataset is not None
