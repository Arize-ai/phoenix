from __future__ import annotations

from opentelemetry.trace import NoOpTracerProvider, TracerProvider
from pydantic_ai import Agent, DeferredToolRequests
from pydantic_ai.capabilities import AgentCapability
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel

from phoenix.server.agents.capabilities import (
    AnthropicPromptCacheCapability,
    MintlifyDocsMCPCapability,
    get_context_capability_function,
)
from phoenix.server.agents.capabilities.tools.external import (
    get_external_tool_capability_function,
)
from phoenix.server.agents.prompts import AgentInstructions
from phoenix.server.agents.pydantic_ai import OpenInferenceAgentWrapper
from phoenix.server.agents.types import AgentDependencies, AgentOutput


def build_agent(
    *,
    model: Model,
    instructions: AgentInstructions | None = None,
    docs_mcp_server: MCPServerStreamableHTTP | None = None,
    tracer_provider: TracerProvider | None = None,
) -> OpenInferenceAgentWrapper[AgentDependencies, AgentOutput]:
    resolved_instructions = instructions or AgentInstructions()
    provider = tracer_provider or NoOpTracerProvider()
    capabilities: list[AgentCapability[AgentDependencies]] = [
        get_external_tool_capability_function(
            instructions=resolved_instructions,
            tracer_provider=provider,
        ),
        get_context_capability_function(instructions=resolved_instructions),
    ]
    if isinstance(model, AnthropicModel):
        capabilities.append(AnthropicPromptCacheCapability())
    if docs_mcp_server is not None:
        capabilities.append(
            MintlifyDocsMCPCapability(
                mcp_server=docs_mcp_server,
                instructions=resolved_instructions.docs_tool,
                tracer_provider=provider,
            )
        )

    agent: Agent[AgentDependencies, AgentOutput] = Agent(
        model,
        name="PXIAgent",
        deps_type=AgentDependencies,
        output_type=[str, DeferredToolRequests],
        instructions=resolved_instructions.base,
        capabilities=capabilities,
    )
    return OpenInferenceAgentWrapper(agent, tracer_provider=provider)
