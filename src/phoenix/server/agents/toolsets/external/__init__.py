from __future__ import annotations

from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import ExternalToolset

from phoenix.server.agents.dependencies import ChatDependencies
from phoenix.server.agents.toolsets.external.tools import (
    ASK_USER_TOOL_DEFINITION,
    BASH_TOOL_DEFINITION,
    CLONE_PROMPT_INSTANCE_TOOL_DEFINITION,
    EDIT_PROMPT_TOOL_DEFINITION,
    READ_PROMPT_TOOL_DEFINITION,
    SET_SPANS_FILTER_TOOL_DEFINITION,
    SET_TIME_RANGE_TOOL_DEFINITION,
)


def build_external_toolset(deps: ChatDependencies) -> ExternalToolset[ChatDependencies]:
    """Build the browser-deferred external toolset gated on request context."""
    return ExternalToolset(build_external_tool_definitions(deps))


def build_external_tool_definitions(deps: ChatDependencies) -> list[ToolDefinition]:
    """Build the browser-deferred external tool definitions for this request."""
    tools: list[ToolDefinition] = [
        BASH_TOOL_DEFINITION,
        ASK_USER_TOOL_DEFINITION,
        SET_TIME_RANGE_TOOL_DEFINITION,
    ]
    project = deps.contexts.project
    playground = deps.contexts.playground
    if project is not None and project.span_filter is not None:
        tools.append(SET_SPANS_FILTER_TOOL_DEFINITION)
    if playground is not None:
        tools.extend(
            [
                READ_PROMPT_TOOL_DEFINITION,
                CLONE_PROMPT_INSTANCE_TOOL_DEFINITION,
                EDIT_PROMPT_TOOL_DEFINITION,
            ]
        )
    return tools


__all__ = ["build_external_tool_definitions", "build_external_toolset"]
