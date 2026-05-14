from __future__ import annotations

from collections.abc import Callable

from opentelemetry.trace import NoOpTracerProvider, TracerProvider
from pydantic_ai import RunContext
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.toolsets import AbstractToolset, CombinedToolset

from phoenix.server.agents.prompts import AgentInstructions
from phoenix.server.agents.pydantic_ai import OpenInferenceToolsetWrapper
from phoenix.server.agents.toolsets.docs_mcp import DocsToolInstructionsToolset
from phoenix.server.agents.toolsets.external import build_external_tools
from phoenix.server.agents.toolsets.external.toolset import ExternalToolsetWithInstructions
from phoenix.server.agents.types import AgentDependencies


def build_toolset_factory(
    *,
    instructions: AgentInstructions,
    docs_mcp_server: MCPServerStreamableHTTP | None = None,
    tracer_provider: TracerProvider | None = None,
) -> Callable[[RunContext[AgentDependencies]], OpenInferenceToolsetWrapper[AgentDependencies]]:
    """Build the per-turn PXI toolset factory with ``instructions`` and
    ``docs_mcp_server`` bound at agent build time."""
    external_tools = build_external_tools(instructions)
    provider = tracer_provider or NoOpTracerProvider()
    docs_toolset = (
        DocsToolInstructionsToolset(
            wrapped=docs_mcp_server,
            instructions=instructions.docs_tool,
        )
        if docs_mcp_server is not None
        else None
    )

    def _build_toolset(
        ctx: RunContext[AgentDependencies],
    ) -> OpenInferenceToolsetWrapper[AgentDependencies]:
        toolsets: list[AbstractToolset[AgentDependencies]] = [
            ExternalToolsetWithInstructions(
                [tool for tool in external_tools if tool.should_include(ctx)]
            ),
        ]
        if docs_toolset is not None:
            toolsets.append(docs_toolset)
        return OpenInferenceToolsetWrapper(
            CombinedToolset(toolsets),
            tracer_provider=provider,
        )

    return _build_toolset


__all__ = ["build_toolset_factory"]
