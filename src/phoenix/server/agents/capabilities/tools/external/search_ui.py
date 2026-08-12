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
                "Free-text search over operation names and descriptions. Empty or "
                "omitted lists the full catalog grouped by namespace."
            ),
        },
    },
    "required": [],
    "additionalProperties": False,
}

DESCRIPTION = """\
Search the catalog of browser UI operations that `execute_ui` scripts can call. Returns TypeScript-style signatures with doc comments for each matching operation, whether it is available on the user's current page, and how to reach it when it is not.
Search before calling any UI operation you have not already used in this conversation — never guess operation names or input shapes. Also search when the user asks to change or read UI state (time ranges, filters, playground prompts, models, datasets, evaluator drafts) and you do not yet know which operation covers it, or when an `execute_ui` call failed with an unknown-operation error or reported that an operation is unavailable on the current page.
Call with a free-text `query` to match operation names and descriptions; call with an empty or omitted `query` to list the full catalog grouped by namespace. Every matching operation is returned whether or not it is usable on the current page; each result says so, with operations usable right now listed first. Operations that are "not on this page" may become available after an action you take (opening a form, navigating) — do not conclude an operation is missing because it is not mounted yet.
Each result is the contract for that operation: use the documented input shape exactly as written when calling it from an `execute_ui` script. Results for operations that are not available on the current page include a route hint describing where they become available — surface that to the user or navigate before executing.
Search once, then reuse what you learned: do not re-search for operations whose signatures are already in this conversation."""

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
