from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "get_route_info"

DESCRIPTION = (
    "Search Phoenix's current React Router route catalog for internal app destinations. "
    "Use this before generating Phoenix UI links."
)

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
class GetRouteInfoCapability(AbstractStaticCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_static_instructions(self) -> str:
        return self.instructions.render()
