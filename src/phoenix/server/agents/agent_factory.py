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
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.models import Model
from pydantic_ai.ui.vercel_ai.response_types import ToolOutputAvailableChunk

from phoenix.server.agents.capabilities import (
    MintlifyDocsMCPCapability,
    NativeToolRetryCapability,
    SkillsCapability,
    build_anthropic_prompt_cache_capability,
    get_context_capability_function,
)
from phoenix.server.agents.capabilities.skills import SkillsToolset
from phoenix.server.agents.capabilities.tools.external import (
    get_external_tool_capability_function,
)
from phoenix.server.agents.capabilities.tools.internal import (
    CallSubAgentCapability,
    GetCurrentDatetimeCapability,
    WriteSpanNoteCapability,
)
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.pydantic_ai import OpenInferenceCapabilityWrapper
from phoenix.server.agents.skills import get_skills_for_contexts
from phoenix.server.agents.types import AgentDependencies, AgentOutput
from phoenix.server.agents.web_access import (
    build_web_fetch_capability,
    build_web_search_capability,
)
from phoenix.server.dml_event import DmlEvent
from phoenix.server.types import CanPutItem, DbSessionFactory


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
    docs_mcp_server: MCPToolset[AgentDependencies] | None = None,
    enable_web_access: bool = False,
    tracer_provider: TracerProvider | None = None,
    server_agent: AbstractAgent[None, str] | None = None,
    publish_subagent_message_chunk: Callable[[ToolOutputAvailableChunk], Awaitable[None]]
    | None = None,
    set_subagent_final_tool_output: Callable[[ToolOutputAvailableChunk], None] | None = None,
    db: DbSessionFactory,
    event_queue: CanPutItem[DmlEvent],
    read_only: bool = False,
    auth_enabled: bool = False,
    user_id: int | None = None,
    is_viewer: bool = False,
) -> AbstractAgent[AgentDependencies, AgentOutput]:
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
        WriteSpanNoteCapability(
            db=db,
            event_queue=event_queue,
            instructions=resolved_prompts.write_span_note_tool.render(),
            read_only=read_only,
            auth_enabled=auth_enabled,
            user_id=user_id,
            is_viewer=is_viewer,
        ),
        GetCurrentDatetimeCapability(
            instructions=resolved_prompts.get_current_datetime_tool.render(),
        ),
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
    if (prompt_cache := build_anthropic_prompt_cache_capability(model)) is not None:
        capabilities.append(prompt_cache)
    if docs_mcp_server is not None:
        capabilities.append(
            MintlifyDocsMCPCapability[AgentDependencies](
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
            CallSubAgentCapability[AgentDependencies](
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

    # The top-level agent is deliberately not wrapped in an
    # OpenInferenceAgentWrapper: per-request AGENT spans grouped each run into
    # an iteration, but the PXI turn reads better as a flat list of model and
    # tool spans parented directly under the browser's `pxi.turn` root (via
    # the propagated trace context).
    agent: Agent[AgentDependencies, AgentOutput] = Agent(
        model,
        name="PXIAgent",
        deps_type=AgentDependencies,
        output_type=[str, DeferredToolRequests],
        instructions=resolved_prompts.base.render(),
        capabilities=[traced_capability, NativeToolRetryCapability()],
    )
    return agent
