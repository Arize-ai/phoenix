from __future__ import annotations

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.dependencies import ChatDependencies
from phoenix.server.agents.toolsets.external.external_tool_definitions import (
    DynamicExternalToolDefinition,
    ExternalToolDefinition,
)
from phoenix.server.agents.toolsets.external.tools import (
    ASK_USER_TOOL_DEFINITION,
    BASH_TOOL_DEFINITION,
    CLONE_PROMPT_INSTANCE_TOOL_DEFINITION,
    EDIT_PROMPT_TOOL_DEFINITION,
    READ_PROMPT_TOOL_DEFINITION,
    SET_SPANS_FILTER_TOOL_DEFINITION,
    SET_TIME_RANGE_TOOL_DEFINITION,
)
from phoenix.server.agents.toolsets.external.toolset import ExternalToolsetWithInstructions

_ALL_EXTERNAL_TOOLS: list[ExternalToolDefinition] = [
    BASH_TOOL_DEFINITION,
    ASK_USER_TOOL_DEFINITION,
    SET_TIME_RANGE_TOOL_DEFINITION,
    SET_SPANS_FILTER_TOOL_DEFINITION,
    READ_PROMPT_TOOL_DEFINITION,
    CLONE_PROMPT_INSTANCE_TOOL_DEFINITION,
    EDIT_PROMPT_TOOL_DEFINITION,
]

# Every dynamic tool must have its include predicate registered via the @TOOL.include decorator
for _tool in _ALL_EXTERNAL_TOOLS:
    if isinstance(_tool, DynamicExternalToolDefinition) and _tool._include_fn is None:
        raise RuntimeError(
            f"DynamicExternalToolDefinition {_tool.name!r} has no include "
            f"function registered. Add `@{_tool.name.upper()}_TOOL_DEFINITION."
            f"include` to its module."
        )


def build_external_toolset(
    ctx: RunContext[ChatDependencies],
) -> ExternalToolsetWithInstructions[ChatDependencies]:
    """Build the browser-deferred external toolset gated on the run context."""
    tools: list[ToolDefinition] = [tool for tool in _ALL_EXTERNAL_TOOLS if tool.should_include(ctx)]
    return ExternalToolsetWithInstructions(tools)


__all__ = ["build_external_toolset"]
