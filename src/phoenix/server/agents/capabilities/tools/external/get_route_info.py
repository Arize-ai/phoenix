from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.types import AgentDependencies

NAME = "get_route_info"

DESCRIPTION = """\
Search Phoenix's current React Router route catalog for internal app destinations, returning root-relative app links for matching pages. Use this before generating a Phoenix UI link when the user names a page, setting, feature, or task instead of an exact route, when choosing between similar destinations (global settings versus project-specific configuration), or when you are unsure a route exists.
Use the returned `link` value when present, and wait for the tool result before rendering a markdown link to that destination.
Returned links are root-relative app paths. Do not add the origin, localhost, or deployment basename.
If a match has `missingParams`, do not fabricate those params and do not render its `path` as a markdown link. Ask for the missing resource or choose the closest non-param route when that satisfies the request; if you need to mention the unresolved route pattern, show it as inline code only.
Do not call this tool for documentation links; use the documentation tools for docs."""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": (
                "Natural-language destination to search for, such as "
                "`data retention policy`, `project traces`, or `agent settings`."
            ),
        },
        "path": {
            "type": "string",
            "description": (
                "Optional root-relative Phoenix UI path to look up exactly, such as "
                "`/settings/data`."
            ),
        },
        "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10,
            "description": "Maximum number of route matches to return. Defaults to 5.",
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
class GetRouteInfoCapability(AbstractCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])
