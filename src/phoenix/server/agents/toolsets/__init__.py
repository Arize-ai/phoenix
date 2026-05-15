from __future__ import annotations

from collections.abc import Callable

from opentelemetry.trace import NoOpTracerProvider, TracerProvider
from pydantic_ai import RunContext
from pydantic_ai.toolsets import AbstractToolset, CombinedToolset

from phoenix.server.agents.dependencies import ChatDependencies
from phoenix.server.agents.prompts import AgentInstructions
from phoenix.server.agents.pydantic_ai import OpenInferenceToolsetWrapper
from phoenix.server.agents.toolsets.docs_mcp import DocsToolInstructionsToolset
from phoenix.server.agents.toolsets.external import build_external_tools
from phoenix.server.agents.toolsets.external.toolset import ExternalToolsetWithInstructions


def build_toolset_factory(
    *,
    instructions: AgentInstructions,
    tracer_provider: TracerProvider | None = None,
) -> Callable[[RunContext[ChatDependencies]], OpenInferenceToolsetWrapper[ChatDependencies]]:
    """Build the per-turn PXI toolset factory with ``instructions`` bound at
    agent build time."""
    external_tools = build_external_tools(instructions)
    docs_tool_instruction = instructions.docs_tool
    provider = tracer_provider or NoOpTracerProvider()

    def _build_toolset(
        ctx: RunContext[ChatDependencies],
    ) -> OpenInferenceToolsetWrapper[ChatDependencies]:
        toolsets: list[AbstractToolset[ChatDependencies]] = [
            ExternalToolsetWithInstructions(
                [tool for tool in external_tools if tool.should_include(ctx)]
            ),
        ]
        if ctx.deps.docs_mcp_server is not None:
            toolsets.append(
                DocsToolInstructionsToolset(
                    wrapped=ctx.deps.docs_mcp_server,
                    instructions=docs_tool_instruction,
                )
            )
        return OpenInferenceToolsetWrapper(
            CombinedToolset(toolsets),
            tracer_provider=provider,
        )

    return _build_toolset


__all__ = ["build_toolset_factory"]
