from __future__ import annotations

from typing import Callable

import strawberry
from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.trace import NoOpTracerProvider, Tracer, TracerProvider
from pydantic_ai import Agent
from pydantic_ai.models import Model

from phoenix.server.agents.capabilities.tools.internal.run_graphql_query import (
    RunGraphQLQueryCapability,
)
from phoenix.server.agents.prompts import ServerAgentPrompts
from phoenix.server.agents.pydantic_ai import OpenInferenceCapabilityWrapper
from phoenix.server.api.context import Context


def build_server_agent(
    *,
    model: Model,
    schema: strawberry.Schema,
    build_graphql_context: Callable[[], Context],
    prompts: ServerAgentPrompts | None = None,
    tracer_provider: TracerProvider | None = None,
) -> Agent[None, str]:
    """Construct server agent."""
    resolved_prompts = prompts or ServerAgentPrompts()
    provider = tracer_provider or NoOpTracerProvider()
    tracer: Tracer = OITracer(
        provider.get_tracer("phoenix.server.agents"),
        config=TraceConfig(),
    )
    capability = RunGraphQLQueryCapability(
        schema=schema,
        build_graphql_context=build_graphql_context,
        instructions=resolved_prompts.run_graphql_query_tool.render(),
    )
    return Agent(
        model,
        name="ServerAgent",
        capabilities=[OpenInferenceCapabilityWrapper(wrapped=capability, tracer=tracer)],
    )
