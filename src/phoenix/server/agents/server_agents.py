from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING

import strawberry
from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.trace import NoOpTracerProvider, Tracer, TracerProvider
from pydantic_ai import Agent
from pydantic_ai.agent.abstract import AbstractAgent
from pydantic_ai.capabilities import AbstractCapability, CombinedCapability
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.models import Model
from pydantic_ai.ui.vercel_ai.response_types import ToolOutputAvailableChunk

from phoenix.server.agents.capabilities import (
    MintlifyDocsMCPCapability,
    PhoenixMCPCapability,
    PhoenixMCPToolset,
    build_anthropic_prompt_cache_capability,
)
from phoenix.server.agents.capabilities.skills import SkillsCapability, SkillsToolset
from phoenix.server.agents.capabilities.tools.internal import CallSubAgentCapability
from phoenix.server.agents.capabilities.tools.internal.bash import (
    BashCapability,
)
from phoenix.server.agents.capabilities.tools.internal.write_span_note import (
    WriteSpanNoteCapability,
)
from phoenix.server.agents.capabilities.viewer_access import ViewerAccessCapability
from phoenix.server.agents.prompts import ServerAgentPrompts
from phoenix.server.agents.pydantic_ai import (
    OpenInferenceAgentWrapper,
    OpenInferenceCapabilityWrapper,
)
from phoenix.server.agents.skills.phoenix_graphql import PHOENIX_GRAPHQL_SKILL
from phoenix.server.agents.skills.span_coding import SPAN_CODING_SKILL
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


async def _discard_subagent_message_chunk(_: ToolOutputAvailableChunk) -> None:
    # TODO: Wire this to the direct server-agent route so preliminary
    # `call_subagent` output chunks stream to the client instead of being dropped.
    return None


def _discard_subagent_final_tool_output(_: ToolOutputAvailableChunk) -> None:
    # TODO: Store final `call_subagent` output chunks for the direct server-agent
    # stream so the renderer can replace preliminary sub-agent output.
    return None


def build_server_agent(
    *,
    model: Model,
    schema: strawberry.Schema,
    build_graphql_context: Callable[[], Context],
    db: DbSessionFactory,
    event_queue: CanPutItem[DmlEvent],
    prompts: ServerAgentPrompts | None = None,
    docs_mcp_server: MCPToolset[None] | None = None,
    phoenix_mcp_server: "FastMCP | None" = None,
    principal: "PhoenixUser | None" = None,
    enable_web_access: bool = False,
    allow_mutations: bool = False,
    require_mutation_approval: bool = True,
    read_only: bool = False,
    auth_enabled: bool = False,
    user_id: int | None = None,
    is_viewer: bool = False,
    tracer_provider: TracerProvider | None = None,
    enable_subagents: bool = False,
    initial_bash_snapshot: bytes | None = None,
    on_bash_snapshot: Callable[[bytes], None] | None = None,
) -> AbstractAgent[None, str]:
    """Construct server agent."""
    resolved_prompts = prompts or ServerAgentPrompts()
    provider = tracer_provider or NoOpTracerProvider()
    tracer: Tracer = OITracer(
        provider.get_tracer("phoenix.server.agents"),
        config=TraceConfig(),
    )
    capabilities: list[AbstractCapability[None]] = [
        BashCapability[None](
            schema=schema,
            build_graphql_context=build_graphql_context,
            allow_mutations=allow_mutations,
            require_mutation_approval=require_mutation_approval,
            initial_snapshot=initial_bash_snapshot,
            on_snapshot=on_bash_snapshot,
        ),
        WriteSpanNoteCapability(
            db=db,
            event_queue=event_queue,
            read_only=read_only,
            auth_enabled=auth_enabled,
            user_id=user_id,
            is_viewer=is_viewer,
        ),
    ]
    capabilities.append(
        SkillsCapability(
            toolset=SkillsToolset[None](
                skills=[PHOENIX_GRAPHQL_SKILL, SPAN_CODING_SKILL],
                load_skill_template=resolved_prompts.load_skill,
            ),
            instructions=resolved_prompts.skills,
        )
    )
    if docs_mcp_server is not None:
        capabilities.append(
            MintlifyDocsMCPCapability[None](
                mcp_server=docs_mcp_server,
                instructions=resolved_prompts.docs_tool,
            )
        )
    if phoenix_mcp_server is not None:
        # Per agent: the toolset carries this request's principal and this run's
        # tool-group reveals.
        capabilities.append(
            PhoenixMCPCapability[None](
                mcp_server=PhoenixMCPToolset[None](
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
    if (prompt_cache := build_anthropic_prompt_cache_capability(model)) is not None:
        capabilities.append(prompt_cache)
    if enable_subagents:
        server_agent = build_server_agent(
            model=model,
            schema=schema,
            build_graphql_context=build_graphql_context,
            db=db,
            event_queue=event_queue,
            docs_mcp_server=docs_mcp_server,
            phoenix_mcp_server=phoenix_mcp_server,
            principal=principal,
            enable_web_access=enable_web_access,
            allow_mutations=allow_mutations,
            require_mutation_approval=require_mutation_approval,
            read_only=read_only,
            auth_enabled=auth_enabled,
            user_id=user_id,
            is_viewer=is_viewer,
            tracer_provider=tracer_provider,
            enable_subagents=False,
        )
        capabilities.append(
            CallSubAgentCapability[None](
                server_agent=server_agent,
                publish_subagent_message_chunk=_discard_subagent_message_chunk,
                set_subagent_final_tool_output=_discard_subagent_final_tool_output,
            )
        )
    if is_viewer:
        capabilities.append(ViewerAccessCapability(instructions=resolved_prompts.viewer_access))
    traced_capability = OpenInferenceCapabilityWrapper(
        wrapped=CombinedCapability(capabilities=capabilities),
        tracer=tracer,
    )
    agent: Agent[None, str] = Agent(
        model,
        name="ServerAgent",
        deps_type=type(None),
        instructions=resolved_prompts.base,
        capabilities=[traced_capability],
    )
    return OpenInferenceAgentWrapper(agent, tracer=tracer)
