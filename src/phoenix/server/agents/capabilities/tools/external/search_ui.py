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

DESCRIPTION = (
    "List the complete catalog of browser UI operations available to execute_ui "
    "scripts, with operations matching your query ranked first. Returns "
    "TypeScript-style signatures with doc comments describing each operation's "
    "input, whether it is available on the user's current page, and how to reach it "
    "if not. Search once before your first execute_ui call — never guess operation "
    "names — then reuse the catalog: repeat calls with different queries return the "
    "same operations, only re-ranked. Call again only to refresh page availability "
    "after navigation."
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
