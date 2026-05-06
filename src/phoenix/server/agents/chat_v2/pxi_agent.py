from opentelemetry.trace import TracerProvider
from pydantic_ai import Agent, DeferredToolRequests, RunContext
from pydantic_ai.agent import InstrumentationSettings
from pydantic_ai.messages import ModelMessage
from pydantic_ai.models import Model

from phoenix.server.agents.chat_v2.dependencies import ChatDependencies
from phoenix.server.agents.chat_v2.toolsets import build_chat_v2_toolsets
from phoenix.server.agents.context import (
    build_phoenix_context_user_message_content,
    insert_context_user_message,
)
from phoenix.server.agents.prompts import (
    AGENT_STATIC_SYSTEM_PROMPT,
    build_agent_dynamic_system_prompt,
)

ChatOutput = str | DeferredToolRequests


def _build_dynamic_instructions(ctx: RunContext[ChatDependencies]) -> str | None:
    """Render request-specific PXI instructions from the run's dependencies."""
    return build_agent_dynamic_system_prompt(capabilities=ctx.deps.capabilities)


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


def create_pxi_agent(
    model: Model,
    *,
    tracer_provider: TracerProvider | None = None,
) -> Agent[ChatDependencies, ChatOutput]:
    instrument = (
        InstrumentationSettings(tracer_provider=tracer_provider)
        if tracer_provider is not None
        else None
    )
    return Agent(
        model,
        deps_type=ChatDependencies,
        output_type=[str, DeferredToolRequests],
        instructions=[AGENT_STATIC_SYSTEM_PROMPT, _build_dynamic_instructions],
        toolsets=[lambda ctx: build_chat_v2_toolsets(ctx.deps)],
        history_processors=[_inject_ui_context],
        instrument=instrument,
    )
