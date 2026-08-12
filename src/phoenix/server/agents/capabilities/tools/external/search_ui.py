from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
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

DESCRIPTION = (
    "Search the catalog of browser UI operations available to execute_ui scripts. "
    "Returns TypeScript-style signatures with doc comments describing each operation's "
    "input, whether it is available on the user's current page, and how to reach it if "
    "not. Always search before calling an operation you have not used in this "
    "conversation — never guess operation names."
)

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SearchUiCapability(AbstractStaticCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_static_instructions(self) -> str:
        return self.instructions.render()
