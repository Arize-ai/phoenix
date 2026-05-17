from opentelemetry.trace import NoOpTracerProvider, TracerProvider
from pydantic_ai import Agent, DeferredToolRequests, RunContext
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.wrapper import WrapperModel

from phoenix.server.agents.capabilities import AnthropicPromptCacheCapability
from phoenix.server.agents.context import GraphQLContext
from phoenix.server.agents.prompts import AgentInstructions
from phoenix.server.agents.pydantic_ai import OpenInferenceAgentWrapper
from phoenix.server.agents.toolsets import build_toolset_factory
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
    build_toolset = build_toolset_factory(
        instructions=resolved_instructions,
        docs_mcp_server=docs_mcp_server,
        tracer_provider=provider,
    )

    capabilities: list[AbstractCapability[AgentDependencies]] = []
    if isinstance(_get_underlying_model(model), AnthropicModel):
        capabilities.append(AnthropicPromptCacheCapability())

    agent = Agent(
        model,
        name="PXIAgent",
        deps_type=AgentDependencies,
        output_type=[str, DeferredToolRequests],
        instructions=[resolved_instructions.base],
        toolsets=[build_toolset],
        capabilities=capabilities,
    )

    @agent.instructions
    def app_instructions(ctx: RunContext[AgentDependencies]) -> str | None:
        app_context = ctx.deps.contexts.app
        if not app_context:
            return None
        return app_context.render_instruction(resolved_instructions)

    @agent.instructions
    def project_instructions(ctx: RunContext[AgentDependencies]) -> str | None:
        project_context = ctx.deps.contexts.project
        if not project_context:
            return None
        return project_context.render_instruction(resolved_instructions)

    @agent.instructions
    def trace_instructions(ctx: RunContext[AgentDependencies]) -> str | None:
        trace_context = ctx.deps.contexts.trace
        if not trace_context:
            return None
        return trace_context.render_instruction(resolved_instructions)

    @agent.instructions
    def span_instructions(ctx: RunContext[AgentDependencies]) -> str | None:
        span_context = ctx.deps.contexts.span
        if not span_context:
            return None
        return span_context.render_instruction(resolved_instructions)

    @agent.instructions
    def playground_instructions(ctx: RunContext[AgentDependencies]) -> str | None:
        playground_context = ctx.deps.contexts.playground
        if not playground_context:
            return None
        return playground_context.render_instruction(resolved_instructions)

    @agent.instructions
    def graphql_instructions(ctx: RunContext[AgentDependencies]) -> str:
        graphql_context = ctx.deps.contexts.graphql
        if not graphql_context:
            return GraphQLContext.render_disabled_default(resolved_instructions)
        return graphql_context.render_instruction(resolved_instructions)

    return OpenInferenceAgentWrapper(agent, tracer_provider=provider)


def _get_underlying_model(model: Model) -> Model:
    current = model
    while isinstance(current, WrapperModel):
        current = current.wrapped
    return current
