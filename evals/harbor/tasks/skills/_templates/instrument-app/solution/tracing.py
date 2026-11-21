"""Reference OpenInference instrumentation for the sample support bot.

`instrument` patches the `SupportBot` class of a loaded bot module in place, so the
bot's source stays uninstrumented for the tasks that ask an agent to instrument it. Each
answer becomes an AGENT span with the conversation ID as `session.id`. The OpenAI
instrumentor adds an LLM span per model call, and each tool call becomes a TOOL span.
"""

from __future__ import annotations

from types import ModuleType
from typing import Any, Callable

from openinference.instrumentation import using_session
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.trace import Status, StatusCode
from phoenix.otel import register


def instrument(module: ModuleType, project_name: str, endpoint: str) -> TracerProvider:
    """Instruments the bot in `module` and returns the tracer provider to flush."""
    provider = register(project_name=project_name, endpoint=endpoint, batch=False, verbose=False)
    OpenAIInstrumentor().instrument(tracer_provider=provider)
    tracer = provider.get_tracer("support_bot")
    bot = module.SupportBot
    answer: Callable[..., str] = bot.answer
    call_tool: Callable[..., str] = bot.call_tool
    chat: Callable[..., list[str]] = bot.chat

    def traced_answer(self: Any, question: str, history: list[dict[str, Any]]) -> str:
        with tracer.start_as_current_span(
            "support_bot",
            openinference_span_kind="agent",
            record_exception=False,
            set_status_on_exception=False,
        ) as span:
            span.set_input(question)
            try:
                reply = answer(self, question, history)
            except Exception as error:
                span.record_exception(error)
                span.set_status(Status(StatusCode.ERROR, type(error).__name__))
                raise
            span.set_output(reply)
            span.set_status(Status(StatusCode.OK))
            return reply

    def traced_call_tool(self: Any, name: str, arguments: str) -> str:
        with tracer.start_as_current_span(name, openinference_span_kind="tool") as span:
            span.set_tool(name=name, parameters=arguments)
            span.set_input(arguments, mime_type="application/json")
            output = call_tool(self, name, arguments)
            span.set_output(output)
            return output

    def traced_chat(self: Any, conversation_id: str, questions: list[str]) -> list[str]:
        with using_session(conversation_id):
            return chat(self, conversation_id, questions)

    bot.answer = traced_answer
    bot.call_tool = traced_call_tool
    bot.chat = traced_chat
    return provider
