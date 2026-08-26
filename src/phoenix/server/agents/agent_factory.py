from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING

import strawberry
from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.trace import NoOpTracerProvider, Tracer, TracerProvider
from pydantic_ai import Agent, DeferredToolRequests
from pydantic_ai.agent.abstract import AbstractAgent
from pydantic_ai.capabilities import (
    AbstractCapability,
    CombinedCapability,
    DynamicCapability,
)
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.models import Model
from pydantic_ai.ui.vercel_ai.response_types import ToolOutputAvailableChunk

from phoenix.server.agents.capabilities import (
    MintlifyDocsMCPCapability,
    NativeToolRetryCapability,
    PhoenixMCPCapability,
    PhoenixMCPToolset,
    SkillsCapability,
    UIContextsCapability,
    build_anthropic_prompt_cache_capability,
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
from phoenix.server.agents.capabilities.tools.internal.bash import BashCapability
from phoenix.server.agents.capabilities.viewer_access import ViewerAccessCapability
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.pydantic_ai import OpenInferenceCapabilityWrapper
from phoenix.server.agents.skills import get_skills
from phoenix.server.agents.types import AgentDependencies, AgentOutput
from phoenix.server.agents.web_access import (
    build_web_fetch_capability,
    build_web_search_capability,
)
from phoenix.server.api.context import Context
from phoenix.server.dml_event import DmlEvent
from phoenix.server.types import CanPutItem, DbSessionFactory

if TYPE_CHECKING:
    from fastmcp import FastMCP

    from phoenix.server.bearer_auth import PhoenixUser


def build_skills_capability(*, prompts: AgentPrompts) -> SkillsCapability[AgentDependencies]:
    return SkillsCapability(
        toolset=SkillsToolset[AgentDependencies](
            skills=get_skills(),
            load_skill_template=prompts.load_skill,
        ),
        instructions=prompts.skills,
    )


def build_agent(
    *,
    model: Model,
    prompts: AgentPrompts | None = None,
    docs_mcp_server: MCPToolset[AgentDependencies] | None = None,
    phoenix_mcp_server: "FastMCP | None" = None,
    principal: "PhoenixUser | None" = None,
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
    schema: strawberry.Schema | None = None,
    build_graphql_context: Callable[[], Context] | None = None,
    allow_mutations: bool = False,
    require_mutation_approval: bool = True,
    initial_bash_snapshot: bytes | None = None,
    on_bash_snapshot: Callable[[bytes], None] | None = None,
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
            read_only=read_only,
            auth_enabled=auth_enabled,
            user_id=user_id,
            is_viewer=is_viewer,
        ),
        GetCurrentDatetimeCapability(),
        DynamicCapability(
            capability_func=get_external_tool_capability_function(),
        ),
        UIContextsCapability(instructions=resolved_prompts.ui_contexts),
        build_skills_capability(prompts=resolved_prompts),
    ]
    if schema is not None and build_graphql_context is not None:
        capabilities.append(
            BashCapability[AgentDependencies](
                schema=schema,
                build_graphql_context=build_graphql_context,
                allow_mutations=allow_mutations,
                require_mutation_approval=require_mutation_approval,
                initial_snapshot=initial_bash_snapshot,
                on_snapshot=on_bash_snapshot,
            )
        )
    if (prompt_cache := build_anthropic_prompt_cache_capability(model)) is not None:
        capabilities.append(prompt_cache)
    if docs_mcp_server is not None:
        capabilities.append(
            MintlifyDocsMCPCapability[AgentDependencies](
                mcp_server=docs_mcp_server,
                instructions=resolved_prompts.docs_tool,
            )
        )
    if phoenix_mcp_server is not None:
        # Per agent: the toolset carries this request's principal and this run's
        # tool-group reveals.
        capabilities.append(
            PhoenixMCPCapability[AgentDependencies](
                mcp_server=PhoenixMCPToolset[AgentDependencies](
                    phoenix_mcp_server,
                    principal=principal,
                    id="phoenix_rest_api",
                ),
                instructions=resolved_prompts.phoenix_mcp_tools,
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
                publish_subagent_message_chunk=publish_subagent_message_chunk,
                set_subagent_final_tool_output=set_subagent_final_tool_output,
            )
        )
    if is_viewer:
        capabilities.append(ViewerAccessCapability(instructions=resolved_prompts.viewer_access))
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
        instructions=resolved_prompts.base,
        capabilities=[traced_capability, NativeToolRetryCapability()],
    )
    return agent
