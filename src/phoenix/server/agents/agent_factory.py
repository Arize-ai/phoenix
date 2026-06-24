from __future__ import annotations

from collections.abc import Awaitable, Callable

from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.trace import NoOpTracerProvider, Tracer, TracerProvider
from pydantic_ai import Agent, DeferredToolRequests, RunContext
from pydantic_ai.agent.abstract import AbstractAgent
from pydantic_ai.capabilities import (
    AbstractCapability,
    CapabilityFunc,
    CombinedCapability,
    DynamicCapability,
)
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.ui.vercel_ai.response_types import ToolOutputAvailableChunk

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
from phoenix.server.agents.capabilities.tools.internal import CallSubAgentCapability
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.pydantic_ai import (
    OpenInferenceAgentWrapper,
    OpenInferenceCapabilityWrapper,
)
from phoenix.server.agents.skills import get_skills_for_contexts
from phoenix.server.agents.types import AgentDependencies, AgentOutput
from phoenix.server.agents.web_access import (
    build_web_fetch_capability,
    build_web_search_capability,
)


def get_skills_capability_function(
    *,
    prompts: AgentPrompts,
) -> CapabilityFunc[AgentDependencies]:
    def _build(ctx: RunContext[AgentDependencies]) -> AbstractCapability[AgentDependencies]:
        return SkillsCapability(
            toolset=SkillsToolset[AgentDependencies](
                skills=get_skills_for_contexts(ctx.deps.contexts),
                load_skill_template=prompts.load_skill,
                load_skill_tool_template=prompts.load_skill_tool,
                read_skill_resource_tool_template=prompts.read_skill_resource_tool,
            ),
            instructions=prompts.skills,
        )

    return _build


def build_agent(
    *,
    model: Model,
    prompts: AgentPrompts | None = None,
    docs_mcp_server: MCPServerStreamableHTTP | None = None,
    enable_web_access: bool = False,
    tracer_provider: TracerProvider | None = None,
    server_agent: AbstractAgent[None, str] | None = None,
    publish_subagent_message_chunk: Callable[[ToolOutputAvailableChunk], Awaitable[None]]
    | None = None,
    set_subagent_final_tool_output: Callable[[ToolOutputAvailableChunk], None] | None = None,
) -> OpenInferenceAgentWrapper[AgentDependencies, AgentOutput]:
    server_agent_args = (
        server_agent,
        publish_subagent_message_chunk,
        set_subagent_final_tool_output,
    )
    if any(arg is not None for arg in server_agent_args) and not all(
        arg is not None for arg in server_agent_args
    ):
        raise ValueError(
            "server_agent, publish_subagent_message_chunk, and "
            "set_subagent_final_tool_output must be provided together."
        )

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
        DynamicCapability(
            capability_func=get_skills_capability_function(
                prompts=resolved_prompts,
            ),
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
    if server_agent is not None:
        assert publish_subagent_message_chunk is not None
        assert set_subagent_final_tool_output is not None
        capabilities.append(
            CallSubAgentCapability(
                server_agent=server_agent,
                instructions=resolved_prompts.call_subagent_tool.render(),
                publish_subagent_message_chunk=publish_subagent_message_chunk,
                set_subagent_final_tool_output=set_subagent_final_tool_output,
            )
        )

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
