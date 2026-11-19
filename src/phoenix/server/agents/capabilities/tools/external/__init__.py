from __future__ import annotations

from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability, CapabilityFunc, CombinedCapability
from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.capabilities.tools.external import (
    ask_user,
    execute_browser_action,
    get_route_info,
    render_generative_ui,
    search_browser_actions,
)
from phoenix.server.agents.capabilities.tools.external.ask_user import AskUserCapability
from phoenix.server.agents.capabilities.tools.external.execute_browser_action import (
    ExecuteBrowserActionCapability,
)
from phoenix.server.agents.capabilities.tools.external.get_route_info import (
    GetRouteInfoCapability,
)
from phoenix.server.agents.capabilities.tools.external.render_generative_ui import (
    RenderGenerativeUICapability,
)
from phoenix.server.agents.capabilities.tools.external.search_browser_actions import (
    SearchBrowserActionsCapability,
)
from phoenix.server.agents.types import AgentDependencies

_EXTERNAL_TOOL_DEFINITIONS_BY_NAME: dict[str, ToolDefinition] = {
    tool_def.name: tool_def
    for tool_def in (
        ask_user.TOOL_DEFINITION,
        execute_browser_action.TOOL_DEFINITION,
        get_route_info.TOOL_DEFINITION,
        render_generative_ui.RENDER_GENERATIVE_UI_TOOL_DEFINITION,
        search_browser_actions.TOOL_DEFINITION,
    )
}


def get_external_tool_definition(name: str) -> ToolDefinition | None:
    """Look up a registered external tool definition by name."""
    return _EXTERNAL_TOOL_DEFINITIONS_BY_NAME.get(name)


def get_external_tool_capability_function() -> CapabilityFunc[AgentDependencies]:
    """Return a ``CapabilityFunc`` that assembles the per-run external-tool
    capability bundle. Every remaining external tool is an ungated capability;
    the per-run hook stays so context-gated tools can rejoin without
    reworking the call sites.
    """
    ungated_capabilities: list[AbstractCapability[AgentDependencies]] = [
        AskUserCapability(),
        SearchBrowserActionsCapability(),
        ExecuteBrowserActionCapability(),
        GetRouteInfoCapability(),
        RenderGenerativeUICapability(),
    ]

    def _build(ctx: RunContext[AgentDependencies]) -> AbstractCapability[AgentDependencies]:
        return CombinedCapability(capabilities=list(ungated_capabilities))

    return _build


__all__ = [
    "AskUserCapability",
    "ExecuteBrowserActionCapability",
    "GetRouteInfoCapability",
    "RenderGenerativeUICapability",
    "SearchBrowserActionsCapability",
    "get_external_tool_capability_function",
    "get_external_tool_definition",
]
