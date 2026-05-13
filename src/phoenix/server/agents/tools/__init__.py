from __future__ import annotations

from opentelemetry.trace import NoOpTracerProvider, TracerProvider
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AbstractToolset, CombinedToolset, ExternalToolset

from phoenix.server.agents.dependencies import ChatDependencies
from phoenix.server.agents.pydantic_ai import OpenInferenceToolsetWrapper
from phoenix.server.agents.tools.external_tools import (
    ASK_USER_TOOL_DEFINITION,
    BASH_TOOL_DEFINITION,
    CLONE_PROMPT_INSTANCE_TOOL_DEFINITION,
    EDIT_PROMPT_TOOL_DEFINITION,
    READ_PROMPT_TOOL_DEFINITION,
    SET_SPANS_FILTER_TOOL_DEFINITION,
    SET_TIME_RANGE_TOOL_DEFINITION,
)
from phoenix.server.agents.toolsets import build_skills_toolset


def build_toolset(
    deps: ChatDependencies,
    *,
    tracer_provider: TracerProvider | None = None,
) -> OpenInferenceToolsetWrapper[ChatDependencies]:
    """Build the combined PXI toolset from request dependencies."""
    external_tools: list[ToolDefinition] = [
        BASH_TOOL_DEFINITION,
        ASK_USER_TOOL_DEFINITION,
        SET_TIME_RANGE_TOOL_DEFINITION,
    ]
    project = deps.contexts.project
    playground = deps.contexts.playground
    if project is not None and project.span_filter is not None:
        external_tools.append(SET_SPANS_FILTER_TOOL_DEFINITION)
    if playground is not None:
        external_tools.extend(
            [
                READ_PROMPT_TOOL_DEFINITION,
                CLONE_PROMPT_INSTANCE_TOOL_DEFINITION,
                EDIT_PROMPT_TOOL_DEFINITION,
            ]
        )
    toolsets: list[AbstractToolset[ChatDependencies]] = [
        ExternalToolset(external_tools),
        build_skills_toolset(),
    ]
    if deps.docs_mcp_toolset is not None:
        toolsets.append(deps.docs_mcp_toolset)
    return OpenInferenceToolsetWrapper(
        CombinedToolset(toolsets),
        tracer_provider=tracer_provider or NoOpTracerProvider(),
    )


__all__ = ["build_toolset"]
