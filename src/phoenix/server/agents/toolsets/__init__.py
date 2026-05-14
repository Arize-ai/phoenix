from __future__ import annotations

from opentelemetry.trace import NoOpTracerProvider, TracerProvider
from pydantic_ai import RunContext
from pydantic_ai.toolsets import AbstractToolset, CombinedToolset

from phoenix.server.agents.dependencies import ChatDependencies
from phoenix.server.agents.pydantic_ai import OpenInferenceToolsetWrapper
from phoenix.server.agents.toolsets.external import build_external_toolset


def build_toolset(
    ctx: RunContext[ChatDependencies],
    *,
    tracer_provider: TracerProvider | None = None,
) -> OpenInferenceToolsetWrapper[ChatDependencies]:
    """Build the combined PXI toolset from the per-turn run context."""
    toolsets: list[AbstractToolset[ChatDependencies]] = [
        build_external_toolset(ctx),
    ]
    if ctx.deps.docs_mcp_toolset is not None:
        toolsets.append(ctx.deps.docs_mcp_toolset)
    return OpenInferenceToolsetWrapper(
        CombinedToolset(toolsets),
        tracer_provider=tracer_provider or NoOpTracerProvider(),
    )


__all__ = [
    "build_toolset",
]
