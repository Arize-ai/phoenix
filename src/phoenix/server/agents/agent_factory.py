from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING

import strawberry
from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.trace import NoOpTracerProvider, Tracer, TracerProvider
from pydantic_ai import Agent, DeferredToolRequests
from pydantic_ai.capabilities import (
    AbstractCapability,
    CombinedCapability,
    DynamicCapability,
)
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.models import Model
from pydantic_ai.ui.vercel_ai.response_types import ToolOutputAvailableChunk

from phoenix.db.types.data_stream_protocol import EditPermission
from phoenix.server.agents.capabilities import (
    MintlifyDocsMCPCapability,
    NativeToolRetryCapability,
    PhoenixMCPCapability,
    PhoenixMCPToolset,
    SubagentCapability,
    UIContextsCapability,
    build_anthropic_prompt_cache_capability,
    build_github_mcp_capability,
)
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
from phoenix.server.agents.github import GitHubMCPConfig
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.pydantic_ai import (
    OpenInferenceAgentWrapper,
    OpenInferenceCapabilityWrapper,
)
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


def build_agent_tracer(tracer_provider: TracerProvider | None) -> Tracer:
    """The OpenInference tracer the PXI agent and its wrappers emit spans through."""
    provider = tracer_provider or NoOpTracerProvider()
    return OITracer(provider.get_tracer("phoenix.server.agents"), config=TraceConfig())


def build_agent(
    *,
    name: str,
    headless: bool,
    model: Model,
    is_subagent: bool = False,
    prompts: AgentPrompts | None = None,
    docs_mcp_server: MCPToolset[AgentDependencies] | None = None,
    phoenix_mcp_server: "FastMCP | None" = None,
    github_mcp_config: GitHubMCPConfig | None = None,
    principal: "PhoenixUser | None" = None,
    enable_web_access: bool = False,
    tracer_provider: TracerProvider | None = None,
    enable_subagents: bool = False,
    publish_subagent_message_chunk: Callable[[ToolOutputAvailableChunk], Awaitable[None]]
    | None = None,
    set_subagent_final_tool_output: Callable[[ToolOutputAvailableChunk], None] | None = None,
    db: DbSessionFactory,
    event_queue: CanPutItem[DmlEvent],
    read_only: bool = False,
    auth_enabled: bool = False,
    edit_permission: EditPermission = "manual",
    graphql_mutations_enabled: bool = False,
    schema: strawberry.Schema | None = None,
    build_graphql_context: Callable[[], Context] | None = None,
    initial_bash_snapshot: bytes | None = None,
    on_bash_snapshot: Callable[[bytes], None] | None = None,
) -> Agent[AgentDependencies, AgentOutput]:
    resolved_prompts = prompts or AgentPrompts()
    user_id = int(principal.identity) if principal is not None else None
    is_viewer = principal.is_viewer if principal is not None else False
    can_approve_mutations = not headless
    # Whether externally-visible writes are possible at all this run: either
    # they bypass approval, or someone is present to approve them.
    writes_permitted = edit_permission == "bypass" or can_approve_mutations
    allow_mutations = graphql_mutations_enabled and writes_permitted
    require_mutation_approval = can_approve_mutations and edit_permission == "manual"
    tracer = build_agent_tracer(tracer_provider)
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
    ]
    if not headless:
        capabilities.extend(
            [
                DynamicCapability(
                    capability_func=get_external_tool_capability_function(),
                ),
                UIContextsCapability(instructions=resolved_prompts.ui_contexts),
            ]
        )
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
                initialize_instructions=phoenix_mcp_server.instructions,
            )
        )
    if github_mcp_config is not None:
        # Per agent: the toolset carries the turn's resolved GitHub token as
        # transport auth. Writes share `writes_permitted` with GraphQL
        # mutations: a headless run has nobody to answer an approval request,
        # so unless edit permission is "bypass" the write tools are filtered
        # out entirely (subagents therefore get read/search only — duplicate
        # checking is delegable, filing stays in the main thread).
        capabilities.append(
            build_github_mcp_capability(
                github_mcp_config,
                instructions=resolved_prompts.github_tools,
                allow_writes=writes_permitted,
                require_write_approval=require_mutation_approval,
            )
        )
    if enable_web_access:
        if (web_search := build_web_search_capability(model)) is not None:
            capabilities.append(web_search)
        if (web_fetch := build_web_fetch_capability(model)) is not None:
            capabilities.append(web_fetch)
    if enable_subagents:
        subagent = build_agent(
            name="PXISubagent",
            headless=True,
            model=model,
            db=db,
            event_queue=event_queue,
            prompts=resolved_prompts,
            principal=principal,
            schema=schema,
            build_graphql_context=build_graphql_context,
            docs_mcp_server=docs_mcp_server,
            phoenix_mcp_server=phoenix_mcp_server,
            github_mcp_config=github_mcp_config,
            tracer_provider=tracer_provider,
            read_only=read_only,
            auth_enabled=auth_enabled,
            edit_permission=edit_permission,
            graphql_mutations_enabled=graphql_mutations_enabled,
            enable_web_access=enable_web_access,
            enable_subagents=False,
            is_subagent=True,
        )
        capabilities.append(
            CallSubAgentCapability(
                subagent=OpenInferenceAgentWrapper(subagent, tracer=tracer),
                publish_subagent_message_chunk=publish_subagent_message_chunk,
                set_subagent_final_tool_output=set_subagent_final_tool_output,
            )
        )
    if is_subagent:
        capabilities.append(SubagentCapability(instructions=resolved_prompts.subagent))
    if is_viewer:
        capabilities.append(ViewerAccessCapability(instructions=resolved_prompts.viewer_access))
    traced_capability = OpenInferenceCapabilityWrapper(
        wrapped=CombinedCapability(capabilities=capabilities),
        tracer=tracer,
    )

    agent: Agent[AgentDependencies, AgentOutput] = Agent(
        model,
        name=name,
        deps_type=AgentDependencies,
        output_type=[str, DeferredToolRequests],
        instructions=resolved_prompts.base,
        capabilities=[traced_capability, NativeToolRetryCapability()],
    )
    return agent
