from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Iterator

from openinference.instrumentation import (
    OITracer,
    TraceConfig,
    get_input_attributes,
    get_output_attributes,
    get_span_kind_attributes,
    get_tool_attributes,
)
from openinference.semconv.trace import OpenInferenceMimeTypeValues, ToolCallAttributes
from opentelemetry.trace import Status, StatusCode, Tracer, TracerProvider
from pydantic_ai._run_context import RunContext
from pydantic_ai.tools import AgentDepsT
from pydantic_ai.toolsets.abstract import AbstractToolset, ToolsetTool
from pydantic_ai.toolsets.wrapper import WrapperToolset


@dataclass(init=False)
class OpenInferenceToolsetWrapper(WrapperToolset[AgentDepsT]):
    """Pydantic-ai ``Toolset`` wrapper that emits an OpenInference ``TOOL`` span per call.

    Wraps ``call_tool`` — the single seam every tool invocation flows through —
    so the wrapper captures every call regardless of which agent or model
    triggered it.
    """

    _tracer: Tracer

    def __init__(
        self,
        wrapped: AbstractToolset[AgentDepsT],
        *,
        tracer_provider: TracerProvider,
    ) -> None:
        super().__init__(wrapped)
        self._tracer = OITracer(
            tracer_provider.get_tracer(__name__),
            config=TraceConfig(),
        )

    async def call_tool(
        self,
        name: str,
        tool_args: dict[str, Any],
        ctx: RunContext[AgentDepsT],
        tool: ToolsetTool[AgentDepsT],
    ) -> Any:
        with self._span(name=name, tool_args=tool_args, ctx=ctx, tool=tool) as set_output:
            result = await super().call_tool(name, tool_args, ctx, tool)
            set_output(result)
            return result

    @contextmanager
    def _span(
        self,
        *,
        name: str,
        tool_args: dict[str, Any],
        ctx: RunContext[AgentDepsT],
        tool: ToolsetTool[AgentDepsT],
    ) -> Iterator[Any]:
        attributes: dict[str, Any] = {
            **get_span_kind_attributes("tool"),
            **get_tool_attributes(
                name=tool.tool_def.name,
                description=tool.tool_def.description,
                parameters=tool.tool_def.parameters_json_schema,
            ),
            **get_input_attributes(tool_args, mime_type=OpenInferenceMimeTypeValues.JSON),
        }
        if ctx.tool_call_id is not None:
            attributes[ToolCallAttributes.TOOL_CALL_ID] = ctx.tool_call_id
        with self._tracer.start_as_current_span(name=name, attributes=attributes) as span:

            def set_output(result: Any) -> None:
                span.set_attributes(get_output_attributes(result))

            yield set_output
            span.set_status(Status(StatusCode.OK))
