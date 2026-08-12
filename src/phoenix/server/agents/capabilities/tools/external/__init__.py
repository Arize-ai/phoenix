from __future__ import annotations

from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability, CapabilityFunc, CombinedCapability
from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.capabilities.tools.external import (
    ask_user,
    execute_ui,
    get_route_info,
    render_generative_ui,
    search_ui,
)
from phoenix.server.agents.capabilities.tools.external.ask_user import AskUserCapability
from phoenix.server.agents.capabilities.tools.external.execute_ui import (
    ExecuteUiCapability,
)
from phoenix.server.agents.capabilities.tools.external.get_route_info import (
    GetRouteInfoCapability,
)
from phoenix.server.agents.capabilities.tools.external.render_generative_ui import (
    RenderGenerativeUICapability,
)
from phoenix.server.agents.capabilities.tools.external.search_ui import (
    SearchUiCapability,
)
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.types import AgentDependencies

_EXTERNAL_TOOL_DEFINITIONS_BY_NAME: dict[str, ToolDefinition] = {
    tool_def.name: tool_def
    for tool_def in (
        ask_user.TOOL_DEFINITION,
        execute_ui.TOOL_DEFINITION,
        get_route_info.TOOL_DEFINITION,
        render_generative_ui.RENDER_GENERATIVE_UI_TOOL_DEFINITION,
        search_ui.TOOL_DEFINITION,
    )
}


def get_external_tool_definition(name: str) -> ToolDefinition | None:
    """Look up a registered external tool definition by name."""
    return _EXTERNAL_TOOL_DEFINITIONS_BY_NAME.get(name)


def get_external_tool_capability_function(
    *,
    prompts: AgentPrompts,
) -> CapabilityFunc[AgentDependencies]:
    """Return a ``CapabilityFunc`` that assembles the per-run external-tool
    capability bundle. Every remaining external tool is a static capability;
    the per-run hook stays so context-gated (dynamic) tools can rejoin without
    reworking the call sites.
    """
    static_capabilities: list[AbstractStaticCapability[AgentDependencies]] = [
        AskUserCapability(instructions=prompts.ask_user_tool),
        SearchUiCapability(instructions=prompts.search_ui_tool),
        ExecuteUiCapability(instructions=prompts.execute_ui_tool),
        GetRouteInfoCapability(instructions=prompts.get_route_info_tool),
        RenderGenerativeUICapability(instructions=prompts.render_generative_ui_tool),
    ]

    def _build(ctx: RunContext[AgentDependencies]) -> AbstractCapability[AgentDependencies]:
        return CombinedCapability(capabilities=list(static_capabilities))

    return _build


__all__ = [
    "AskUserCapability",
    "ExecuteUiCapability",
    "GetRouteInfoCapability",
    "RenderGenerativeUICapability",
    "SearchUiCapability",
    "get_external_tool_capability_function",
    "get_external_tool_definition",
]
