from opentelemetry.trace import NoOpTracerProvider, TracerProvider
from pydantic_ai import Agent, DeferredToolRequests, RunContext
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.messages import ModelMessage
from pydantic_ai.models import Model

from phoenix.server.agents.context import (
    build_phoenix_context_user_message_content,
    insert_context_user_message,
)
from phoenix.server.agents.prompts import AgentInstructions
from phoenix.server.agents.pydantic_ai import OpenInferenceAgentWrapper
from phoenix.server.agents.toolsets import build_toolset_factory
from phoenix.server.agents.types import AgentDependencies, AgentOutput


def _inject_ui_context(
    ctx: RunContext[AgentDependencies],
    messages: list[ModelMessage],
) -> list[ModelMessage]:
    """Append the per-turn Phoenix UI context as a trailing user message.

    Running as a history processor (rather than mutating the request body)
    keeps the static prefix — system prompt + prior conversation history —
    byte-identical across turns, which is the prerequisite for any
    provider-side prompt cache to take effect.
    """
    return insert_context_user_message(
        messages,
        build_phoenix_context_user_message_content(ctx.deps.contexts),
    )


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

    agent = Agent(
        model,
        name="PXIAgent",
        deps_type=AgentDependencies,
        output_type=[str, DeferredToolRequests],
        instructions=[resolved_instructions.base],
        toolsets=[build_toolset],
        history_processors=[_inject_ui_context],
    )

    @agent.instructions
    def graphql_instructions(ctx: RunContext[AgentDependencies]) -> str:
        graphql = ctx.deps.contexts.graphql
        if graphql is not None and graphql.mutations_enabled:
            return resolved_instructions.graphql_mutations_enabled
        return resolved_instructions.graphql_mutations_disabled

    return OpenInferenceAgentWrapper(agent, tracer_provider=provider)
