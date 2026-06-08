from __future__ import annotations

from typing import Callable, Optional

import strawberry
from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.trace import NoOpTracerProvider, Tracer, TracerProvider
from pydantic_ai import Agent
from pydantic_ai.models import Model
from starlette.requests import Request as StarletteRequest

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
    build_context: Callable[..., Context],
    request: Optional[StarletteRequest],
    prompts: ServerAgentPrompts | None = None,
    tracer_provider: TracerProvider | None = None,
) -> Agent[None, str]:
    """Construct the per-request GraphQL server agent.

    The agent is built per request because it needs the per-request ``model``; the
    ``schema``/``build_context``/``request`` triple is closed over by its
    ``RunGraphQLQueryCapability`` so the query tool can run networklessly with the
    caller's identity.

    The capability is wrapped in an ``OpenInferenceCapabilityWrapper`` so each
    ``run_graphql_query`` invocation emits a ``TOOL`` span. Without this the server
    agent's GraphQL calls are invisible under the parent ``call_subagent`` span
    (only its LLM spans surface, via the OpenInference-wrapped ``model``).
    """
    resolved_prompts = prompts or ServerAgentPrompts()
    provider = tracer_provider or NoOpTracerProvider()
    tracer: Tracer = OITracer(
        provider.get_tracer("phoenix.server.agents"),
        config=TraceConfig(),
    )
    capability = RunGraphQLQueryCapability(
        schema=schema,
        build_context=build_context,
        request=request,
        instructions=resolved_prompts.run_graphql_query_tool.render(),
    )
    return Agent(
        model,
        name="ServerAgent",
        capabilities=[OpenInferenceCapabilityWrapper(wrapped=capability, tracer=tracer)],
    )
