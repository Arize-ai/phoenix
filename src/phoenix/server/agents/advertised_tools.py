"""Resolve the PXI tools advertised for a chat turn."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

from phoenix.server.agents.dependencies import ChatDependencies
from phoenix.server.agents.toolsets.external import build_external_tool_definitions


class AgentAdvertisedTool(BaseModel):
    """Tool name and execution owner advertised to the browser."""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    execution: Literal["browser", "server"]
    family: str | None = None


class AgentAdvertisedToolsData(BaseModel):
    """Data chunk payload sent before PXI tool calls stream."""

    model_config = ConfigDict(populate_by_name=True)

    tools: list[AgentAdvertisedTool]


async def resolve_advertised_tools(deps: ChatDependencies) -> list[AgentAdvertisedTool]:
    """Resolve the tool ownership manifest for one chat request."""
    tools = [
        AgentAdvertisedTool(
            name=tool_definition.name,
            execution="browser",
            family="external",
        )
        for tool_definition in build_external_tool_definitions(deps)
    ]
    if deps.docs_mcp_toolset is not None:
        tool_prefix = deps.docs_mcp_toolset.tool_prefix
        tools.extend(
            AgentAdvertisedTool(
                name=f"{tool_prefix}_{tool.name}" if tool_prefix else tool.name,
                execution="server",
                family="docs",
            )
            for tool in await deps.docs_mcp_toolset.list_tools()
        )
    return tools
