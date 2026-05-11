from __future__ import annotations

from collections.abc import AsyncIterator, Iterator, Sequence
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass
from typing import Any, Callable

from openinference.instrumentation import (
    OITracer,
    TraceConfig,
    get_input_attributes,
    get_output_attributes,
    get_span_kind_attributes,
)
from openinference.semconv.trace import OpenInferenceMimeTypeValues
from opentelemetry.trace import Status, StatusCode, Tracer, TracerProvider
from pydantic_ai.agent.abstract import AbstractAgent
from pydantic_ai.agent.wrapper import WrapperAgent
from pydantic_ai.messages import UserContent
from pydantic_ai.output import OutputDataT
from pydantic_ai.run import AgentRun, AgentRunResult
from pydantic_ai.tools import AgentDepsT


@dataclass(init=False)
class OpenInferenceAgentWrapper(WrapperAgent[AgentDepsT, OutputDataT]):
    """Pydantic-ai ``Agent`` wrapper that emits a single OpenInference ``AGENT`` span per turn.

    Overrides ``iter`` only — every other agent run entry point (``run``,
    ``run_sync``, ``run_stream``, ``run_stream_events``) ultimately delegates
    through ``iter`` in ``AbstractAgent``, so a single seam captures all
    execution paths.
    """

    _tracer: Tracer

    def __init__(
        self,
        wrapped: AbstractAgent[AgentDepsT, OutputDataT],
        *,
        tracer_provider: TracerProvider,
    ) -> None:
        super().__init__(wrapped)
        self._tracer = OITracer(
            tracer_provider.get_tracer(__name__),
            config=TraceConfig(),
        )

    @asynccontextmanager
    async def iter(
        self,
        user_prompt: str | Sequence[UserContent] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[AgentRun[AgentDepsT, Any]]:
        with self._span(user_prompt=user_prompt, kwargs=kwargs) as set_result:
            async with super().iter(user_prompt, **kwargs) as agent_run:
                yield agent_run
                set_result(agent_run.result)

    @contextmanager
    def _span(
        self,
        *,
        user_prompt: str | Sequence[UserContent] | None,
        kwargs: dict[str, Any],
    ) -> Iterator[Callable[[AgentRunResult[Any] | None], None]]:
        input_value: dict[str, Any] = {
            "user_prompt": user_prompt,
            **{k: v for k, v in kwargs.items() if v is not None},
        }
        message_history = input_value.get("message_history")
        if message_history is not None:
            input_value["message_history"] = list(message_history)
        attributes = {
            **get_span_kind_attributes("agent"),
            **get_input_attributes(input_value, mime_type=OpenInferenceMimeTypeValues.JSON),
        }
        span_name = f"{self.name or type(self.wrapped).__name__}.iter"
        with self._tracer.start_as_current_span(
            name=span_name,
            attributes=attributes,
        ) as span:

            def set_result(result: AgentRunResult[Any] | None) -> None:
                if result is None:
                    return
                span.set_attributes(get_output_attributes(result.output))

            yield set_result
            span.set_status(Status(StatusCode.OK))
