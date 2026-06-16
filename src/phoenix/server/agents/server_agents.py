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
from phoenix.server.agents.capabilities.skills import SkillsCapability, SkillsToolset
from phoenix.server.agents.capabilities.tools.internal.bash import (
    BashCapability,
)
from phoenix.server.agents.prompts import ServerAgentPrompts
from phoenix.server.agents.pydantic_ai import (
    OpenInferenceAgentWrapper,
    OpenInferenceCapabilityWrapper,
)
from phoenix.server.agents.skills.phoenix_graphql import PHOENIX_GRAPHQL_SKILL
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
    allow_mutations: bool = False,
    tracer_provider: TracerProvider | None = None,
) -> AbstractAgent[None, str]:
    """Construct server agent.

        ``docs_mcp_server`` and ``enable_web_access`` are gated by the caller exactly as
        they are for the main agent, so the sub-agent gains the docs MCP and web
    search/fetch tools under the same conditions. ``allow_mutations`` controls whether
    the bash ``phoenix-gql`` command may execute GraphQL mutations, mirroring the
    frontend command's permission gating.

    The server agent always receives the GraphQL skill through the same
    progressive-disclosure skills toolset the main agent uses.
    """
    resolved_prompts = prompts or ServerAgentPrompts()
    provider = tracer_provider or NoOpTracerProvider()
    tracer: Tracer = OITracer(
        provider.get_tracer("phoenix.server.agents"),
        config=TraceConfig(),
    )
    capabilities: list[AbstractCapability[None]] = [
        BashCapability(
            schema=schema,
            build_graphql_context=build_graphql_context,
            instructions=resolved_prompts.bash_tool.render(enable_web_access=enable_web_access),
            allow_mutations=allow_mutations,
            enable_web_access=enable_web_access,
        ),
    ]
    capabilities.append(
        SkillsCapability(
            toolset=SkillsToolset[None](
                skills=[PHOENIX_GRAPHQL_SKILL],
                load_skill_template=resolved_prompts.load_skill,
                load_skill_tool_template=resolved_prompts.load_skill_tool,
                read_skill_resource_tool_template=resolved_prompts.read_skill_resource_tool,
            ),
            instructions=resolved_prompts.skills,
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
