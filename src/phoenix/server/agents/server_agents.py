from __future__ import annotations

from typing import Callable

import strawberry
from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.trace import NoOpTracerProvider, Tracer, TracerProvider
from pydantic_ai import Agent
from pydantic_ai.agent.abstract import AbstractAgent
from pydantic_ai.capabilities import AbstractCapability, CombinedCapability
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.models import Model

from phoenix.server.agents.capabilities import MintlifyDocsMCPCapability
from phoenix.server.agents.capabilities.tools.internal.bash import (
    BashCapability,
    bash_tool_available,
)
from phoenix.server.agents.capabilities.tools.internal.run_graphql_query import (
    RunGraphQLQueryCapability,
)
from phoenix.server.agents.prompts import ServerAgentPrompts
from phoenix.server.agents.pydantic_ai import (
    OpenInferenceAgentWrapper,
    OpenInferenceCapabilityWrapper,
)
from phoenix.server.agents.web_access import (
    build_web_fetch_capability,
    build_web_search_capability,
)
from phoenix.server.api.context import Context


def build_server_agent(
    *,
    model: Model,
    schema: strawberry.Schema,
    build_graphql_context: Callable[[], Context],
    prompts: ServerAgentPrompts | None = None,
    docs_mcp_server: MCPServerStreamableHTTP | None = None,
    enable_web_access: bool = False,
    tracer_provider: TracerProvider | None = None,
) -> AbstractAgent[None, str]:
    """Construct server agent.

    ``docs_mcp_server`` and ``enable_web_access`` are gated by the caller exactly as
    they are for the main agent, so the sub-agent gains the docs MCP and web
    search/fetch tools under the same conditions.

    A fresh virtual filesystem is created for the bash tool on each build. Build a
    new server agent per ``call_subagent`` invocation to scope it to that invocation.
    """
    resolved_prompts = prompts or ServerAgentPrompts()
    provider = tracer_provider or NoOpTracerProvider()
    tracer: Tracer = OITracer(
        provider.get_tracer("phoenix.server.agents"),
        config=TraceConfig(),
    )
    capabilities: list[AbstractCapability[None]] = [
        RunGraphQLQueryCapability(
            schema=schema,
            build_graphql_context=build_graphql_context,
            instructions=resolved_prompts.run_graphql_query_tool.render(),
        ),
    ]
    if bash_tool_available():
        capabilities.append(
            BashCapability(
                schema=schema,
                build_graphql_context=build_graphql_context,
                instructions=resolved_prompts.bash_tool.render(),
            )
        )
    if docs_mcp_server is not None:
        capabilities.append(
            MintlifyDocsMCPCapability(
                mcp_server=docs_mcp_server,
                instructions=resolved_prompts.docs_tool,
            )
        )
    if enable_web_access:
        if (web_search := build_web_search_capability(model)) is not None:
            capabilities.append(web_search)
        if (web_fetch := build_web_fetch_capability(model)) is not None:
            capabilities.append(web_fetch)
    traced_capability = OpenInferenceCapabilityWrapper(
        wrapped=CombinedCapability(capabilities=capabilities),
        tracer=tracer,
    )
    agent: Agent[None, str] = Agent(
        model,
        name="ServerAgent",
        instructions=resolved_prompts.base.render(),
        capabilities=[traced_capability],
    )
    return OpenInferenceAgentWrapper(agent, tracer=tracer)
