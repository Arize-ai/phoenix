from __future__ import annotations

from dataclasses import KW_ONLY, dataclass
from datetime import datetime
from typing import Any

from openinference.instrumentation import (
    get_input_attributes,
    get_output_attributes,
    get_span_kind_attributes,
)
from openinference.semconv.trace import (
    OpenInferenceMimeTypeValues,
    SpanAttributes,
    ToolCallAttributes,
)
from opentelemetry.trace import Status, StatusCode, Tracer
from pydantic_ai import RunContext
from pydantic_ai.capabilities import (
    ValidatedToolArgs,
    WrapperCapability,
    WrapToolExecuteHandler,
)
from pydantic_ai.messages import (
    ModelResponse,
    NativeToolCallPart,
    NativeToolReturnPart,
    ToolCallPart,
)
from pydantic_ai.models import ModelRequestContext
from pydantic_ai.tools import AgentDepsT, ToolDefinition

from phoenix.server.agents.pydantic_ai.tool_spans import ToolSpanMixin


@dataclass
class OpenInferenceCapabilityWrapper(WrapperCapability[AgentDepsT], ToolSpanMixin):
    """Pydantic-ai ``Capability`` wrapper that emits OpenInference ``TOOL`` spans."""

    _: KW_ONLY
    tracer: Tracer

    async def wrap_tool_execute(
        self,
        ctx: RunContext[AgentDepsT],
        *,
        call: ToolCallPart,
        tool_def: ToolDefinition,
        args: ValidatedToolArgs,
        handler: WrapToolExecuteHandler,
    ) -> Any:
        with self._tool_span(
            tool_def=tool_def,
            tool_args=args,
            tool_call_id=call.tool_call_id,
        ) as set_output:
            result = await super().wrap_tool_execute(
                ctx, call=call, tool_def=tool_def, args=args, handler=handler
            )
            set_output(result)
            return result

    async def after_model_request(
        self,
        ctx: RunContext[AgentDepsT],
        *,
        request_context: ModelRequestContext,
        response: ModelResponse,
    ) -> ModelResponse:
        self._emit_native_tool_spans(response)
        return await super().after_model_request(
            ctx, request_context=request_context, response=response
        )

    def _emit_native_tool_spans(self, response: ModelResponse) -> None:
        native_tool_call_parts_by_id: dict[str, NativeToolCallPart] = {}
        native_tool_return_parts_by_id: dict[str, NativeToolReturnPart] = {}
        for part in response.parts:
            if isinstance(part, NativeToolCallPart):
                native_tool_call_parts_by_id[part.tool_call_id] = part
            elif isinstance(part, NativeToolReturnPart):
                native_tool_return_parts_by_id[part.tool_call_id] = part

        for tool_call_id, call_part in native_tool_call_parts_by_id.items():
            self._emit_native_tool_span(
                call_part=call_part,
                return_part=native_tool_return_parts_by_id.get(tool_call_id),
                fallback_timestamp=response.timestamp,
            )

    def _emit_native_tool_span(
        self,
        *,
        call_part: NativeToolCallPart,
        return_part: NativeToolReturnPart | None,
        fallback_timestamp: datetime,
    ) -> None:
        attributes: dict[str, Any] = {
            **get_span_kind_attributes("tool"),
            SpanAttributes.TOOL_NAME: call_part.tool_name,
            **get_input_attributes(
                call_part.args_as_dict(),
                mime_type=OpenInferenceMimeTypeValues.JSON,
            ),
            ToolCallAttributes.TOOL_CALL_ID: call_part.tool_call_id,
        }
        if return_part is not None:
            attributes.update(get_output_attributes(return_part.content))
        span_timestamp = _to_unix_nano(
            return_part.timestamp if return_part is not None else fallback_timestamp
        )
        span = self.tracer.start_span(
            name=call_part.tool_name,
            attributes=attributes,
            start_time=span_timestamp,
        )
        if return_part is None or return_part.outcome == "success":
            span.set_status(Status(StatusCode.OK))
        else:
            error_message = (
                str(return_part.content) if return_part.content is not None else return_part.outcome
            )
            span.record_exception(Exception(error_message))
            span.set_status(Status(StatusCode.ERROR))
        span.end(end_time=span_timestamp)


def _to_unix_nano(timestamp: datetime) -> int:
    return int(timestamp.timestamp() * 1_000_000_000)
