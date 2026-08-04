from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Callable, Iterator

from openinference.instrumentation import (
    get_input_attributes,
    get_output_attributes,
    get_span_kind_attributes,
    get_tool_attributes,
)
from openinference.semconv.trace import OpenInferenceMimeTypeValues, ToolCallAttributes
from opentelemetry.trace import Status, StatusCode, Tracer
from pydantic_ai.tools import ToolDefinition


class ToolSpanMixin:
    """Shared OpenInference ``TOOL``-span emission for tool-invocation wrappers.

    Subclasses set ``tracer`` and call ``_tool_span`` as a context manager around
    each tool invocation. The ``set_output`` callable the manager yields is
    invoked once the tool result is known, so the OK status is set when the
    ``with`` block exits cleanly and OpenTelemetry's default exception handling
    records errors otherwise.
    """

    tracer: Tracer

    @contextmanager
    def _tool_span(
        self,
        *,
        tool_def: ToolDefinition,
        tool_args: dict[str, Any],
        tool_call_id: str | None,
    ) -> Iterator[Callable[[Any], None]]:
        attributes: dict[str, Any] = {
            **get_span_kind_attributes("tool"),
            **get_tool_attributes(
                name=tool_def.name,
                description=tool_def.description,
                parameters=tool_def.parameters_json_schema,
            ),
            **get_input_attributes(tool_args, mime_type=OpenInferenceMimeTypeValues.JSON),
        }
        if tool_call_id is not None:
            attributes[ToolCallAttributes.TOOL_CALL_ID] = tool_call_id
        with self.tracer.start_as_current_span(
            name=tool_def.name,
            attributes=attributes,
        ) as span:

            def set_output(result: Any) -> None:
                span.set_attributes(get_output_attributes(result))

            yield set_output
            span.set_status(Status(StatusCode.OK))
