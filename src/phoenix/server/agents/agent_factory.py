from opentelemetry.trace import NoOpTracerProvider, TracerProvider
from pydantic_ai import Agent, DeferredToolRequests, RunContext
from pydantic_ai.messages import ModelMessage
from pydantic_ai.models import Model

from phoenix.server.agents.capabilities import build_capability_system_prompt
from phoenix.server.agents.context import (
    build_phoenix_context_user_message_content,
    insert_context_user_message,
)
from phoenix.server.agents.dependencies import ChatDependencies
from phoenix.server.agents.prompts import AgentInstructions
from phoenix.server.agents.pydantic_ai import (
    OpenInferenceAgentWrapper,
    OpenInferenceToolsetWrapper,
)
from phoenix.server.agents.toolsets import build_toolset

ChatOutput = str | DeferredToolRequests


def _inject_ui_context(
    ctx: RunContext[ChatDependencies],
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
    tracer_provider: TracerProvider | None = None,
) -> OpenInferenceAgentWrapper[ChatDependencies, ChatOutput]:
    resolved_instructions = instructions or AgentInstructions()
    provider = tracer_provider or NoOpTracerProvider()

    def _build_toolset(
        ctx: RunContext[ChatDependencies],
    ) -> OpenInferenceToolsetWrapper[ChatDependencies]:
        return build_toolset(ctx, tracer_provider=provider)

    agent = Agent(
        model,
        name="PXIAgent",
        deps_type=ChatDependencies,
        output_type=[str, DeferredToolRequests],
        instructions=[resolved_instructions.base],
        toolsets=[_build_toolset],
        history_processors=[_inject_ui_context],
    )

    @agent.instructions
    def capability_instructions(ctx: RunContext[ChatDependencies]) -> str | None:
        sections = []

        capability_prompt = build_capability_system_prompt(ctx.deps.capabilities)
        if capability_prompt:
            sections.append(capability_prompt)

        if not sections:
            return None
        return "\n\n".join(sections)

    return OpenInferenceAgentWrapper(agent, tracer_provider=provider)
