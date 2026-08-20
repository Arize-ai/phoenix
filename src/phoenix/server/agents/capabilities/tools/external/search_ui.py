from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.types import AgentDependencies

NAME = "search_ui"

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": (
                "Optional free-text ranking hint matched against operation names and "
                "descriptions. The complete catalog is always returned; matching "
                "operations simply sort first. Empty or omitted ranks by page "
                "availability alone."
            ),
        },
    },
    "required": [],
    "additionalProperties": False,
}

DESCRIPTION = """\
List the complete catalog of browser UI operations that `execute_ui` scripts can call, with operations matching your query ranked first. Returns TypeScript-style signatures with doc comments for every operation, whether it is available on the user's current page, and how to reach it when it is not.
Search once per conversation, before your first `execute_ui` call — never guess operation names or input shapes. Search again only when an `execute_ui` call failed with an unknown-operation error and the catalog is not already in this conversation, or when the user navigated to a different page and you need to refresh which operations are available there.
One call returns the complete catalog. The `query` only ranks — it never filters — so repeat calls with different queries return the same operations re-ordered. Never issue multiple `search_ui` calls back to back; reuse the catalog you already have.
Every operation is returned whether or not it is usable on the current page; each result says so, with operations usable right now listed first. Operations that are "not on this page" may become available after an action you take (opening a form, navigating) — do not conclude an operation is missing because it is not mounted yet.
Each result is the contract for that operation: use the documented input shape exactly as written when calling it from an `execute_ui` script. Results for operations that are not available on the current page include a route hint describing where they become available — surface that to the user or navigate before executing.
Availability is the only thing that changes between calls: re-call only when the page changed and you need to know what is mounted now."""

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SearchUiCapability(AbstractCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])
