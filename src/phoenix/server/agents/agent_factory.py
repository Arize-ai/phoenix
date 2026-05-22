from __future__ import annotations

from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.trace import NoOpTracerProvider, Tracer, TracerProvider
from pydantic_ai import Agent, DeferredToolRequests
from pydantic_ai.capabilities import (
    AbstractCapability,
    CombinedCapability,
    DynamicCapability,
)
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel

from phoenix.server.agents.capabilities import (
    AnthropicPromptCacheCapability,
    MintlifyDocsMCPCapability,
    SkillsCapability,
    get_context_capability_function,
)
from phoenix.server.agents.capabilities.skills import SkillsToolset
from phoenix.server.agents.capabilities.tools.external import (
    get_external_tool_capability_function,
)
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.pydantic_ai import (
    OpenInferenceAgentWrapper,
    OpenInferenceCapabilityWrapper,
)
from phoenix.server.agents.skills import build_skills
from phoenix.server.agents.types import AgentDependencies, AgentOutput
from phoenix.server.agents.web_access import (
    build_web_fetch_capability,
    build_web_search_capability,
)


def build_agent(
    *,
    model: Model,
    prompts: AgentPrompts | None = None,
    docs_mcp_server: MCPServerStreamableHTTP | None = None,
    enable_web_access: bool = False,
    tracer_provider: TracerProvider | None = None,
) -> OpenInferenceAgentWrapper[AgentDependencies, AgentOutput]:
    resolved_prompts = prompts or AgentPrompts()
    provider = tracer_provider or NoOpTracerProvider()
    tracer: Tracer = OITracer(
        provider.get_tracer("phoenix.server.agents"),
        config=TraceConfig(),
    )
    capabilities: list[AbstractCapability[AgentDependencies]] = [
        DynamicCapability(
            capability_func=get_external_tool_capability_function(
                prompts=resolved_prompts,
            ),
        ),
        DynamicCapability(
            capability_func=get_context_capability_function(prompts=resolved_prompts),
        ),
        SkillsCapability(
            toolset=SkillsToolset(
                skills=build_skills(),
                load_skill_template=resolved_prompts.load_skill,
            ),
            instructions=resolved_prompts.skills,
        ),
    ]
    if isinstance(model, AnthropicModel):
        capabilities.append(AnthropicPromptCacheCapability())
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

    agent: Agent[AgentDependencies, AgentOutput] = Agent(
        model,
        name="PXIAgent",
        deps_type=AgentDependencies,
        output_type=[str, DeferredToolRequests],
        instructions=resolved_prompts.base.render(),
        capabilities=[traced_capability],
    )
    return OpenInferenceAgentWrapper(agent, tracer=tracer)
