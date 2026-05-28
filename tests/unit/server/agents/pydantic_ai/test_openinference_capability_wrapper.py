from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable

import pytest
from openinference.instrumentation import OITracer, TraceConfig
from openinference.semconv.trace import (
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolCallAttributes,
)
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode, Tracer
from pydantic_ai._run_context import RunContext
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.messages import (
    ModelResponse,
    NativeToolCallPart,
    NativeToolReturnPart,
    ToolCallPart,
)
from pydantic_ai.models import ModelRequestContext, ModelRequestParameters
from pydantic_ai.models.test import TestModel
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.usage import RunUsage

from phoenix.server.agents.pydantic_ai import OpenInferenceCapabilityWrapper


@dataclass
class _NoOpCapability(AbstractCapability[None]):
    """Bare capability used as the wrapped target — every default hook applies."""


@pytest.fixture
def in_memory_span_exporter() -> InMemorySpanExporter:
    return InMemorySpanExporter()


@pytest.fixture
def tracer_provider(in_memory_span_exporter: InMemorySpanExporter) -> TracerProvider:
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(in_memory_span_exporter))
    return provider


@pytest.fixture
def tracer(tracer_provider: TracerProvider) -> Tracer:
    return OITracer(tracer_provider.get_tracer("test"), config=TraceConfig())


@pytest.fixture
def add_tool_def() -> ToolDefinition:
    return ToolDefinition(
        name="add",
        description="Add two integers.",
        parameters_json_schema={
            "type": "object",
            "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}},
            "required": ["a", "b"],
            "additionalProperties": False,
        },
    )


@pytest.fixture
def explode_tool_def() -> ToolDefinition:
    return ToolDefinition(
        name="explode",
        description="Always raises with the given reason.",
        parameters_json_schema={
            "type": "object",
            "properties": {"reason": {"type": "string"}},
            "required": ["reason"],
            "additionalProperties": False,
        },
    )


@pytest.fixture
def make_ctx() -> Callable[..., RunContext[None]]:
    def _factory(*, tool_call_id: str | None, tool_name: str | None) -> RunContext[None]:
        return RunContext[None](
            deps=None,
            model=TestModel(),
            usage=RunUsage(),
            tool_call_id=tool_call_id,
            tool_name=tool_name,
        )

    return _factory


async def test_wrap_tool_execute_emits_tool_span(
    add_tool_def: ToolDefinition,
    in_memory_span_exporter: InMemorySpanExporter,
    tracer: Tracer,
    make_ctx: Callable[..., RunContext[None]],
) -> None:
    wrapper = OpenInferenceCapabilityWrapper[None](
        wrapped=_NoOpCapability(),
        tracer=tracer,
    )
    tool_args = {"a": 2, "b": 3}

    async def handler(args: dict[str, Any]) -> int:
        a: int = args["a"]
        b: int = args["b"]
        return a + b

    ctx = make_ctx(tool_call_id="call_42", tool_name="add")
    call = ToolCallPart(tool_name="add", args=tool_args, tool_call_id="call_42")

    result = await wrapper.wrap_tool_execute(
        ctx, call=call, tool_def=add_tool_def, args=tool_args, handler=handler
    )

    assert result == 5

    spans = in_memory_span_exporter.get_finished_spans()
    assert len(spans) == 1
    span = spans[0]
    assert span.name == "add"
    assert span.status.status_code == StatusCode.OK
    assert span.parent is None

    attributes = dict(span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == TOOL
    assert attributes.pop(TOOL_NAME) == "add"
    assert attributes.pop(TOOL_DESCRIPTION) == "Add two integers."

    parameters = attributes.pop(TOOL_PARAMETERS)
    assert isinstance(parameters, str)
    assert json.loads(parameters) == {
        "type": "object",
        "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}},
        "required": ["a", "b"],
        "additionalProperties": False,
    }

    assert attributes.pop(TOOL_CALL_ID) == "call_42"

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    parsed_input = json.loads(input_value)
    assert set(parsed_input) == {"a", "b"}
    assert parsed_input["a"] == 2
    assert parsed_input["b"] == 3
    assert attributes.pop(INPUT_MIME_TYPE) == JSON

    assert attributes.pop(OUTPUT_VALUE) == "5"
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT

    assert not attributes


async def test_wrap_tool_execute_records_exception_when_handler_raises(
    explode_tool_def: ToolDefinition,
    in_memory_span_exporter: InMemorySpanExporter,
    tracer: Tracer,
    make_ctx: Callable[..., RunContext[None]],
) -> None:
    wrapper = OpenInferenceCapabilityWrapper[None](
        wrapped=_NoOpCapability(),
        tracer=tracer,
    )
    tool_args = {"reason": "kaboom"}

    async def handler(args: dict[str, Any]) -> str:
        raise RuntimeError(f"boom: {args['reason']}")

    ctx = make_ctx(tool_call_id="call_err", tool_name="explode")
    call = ToolCallPart(tool_name="explode", args=tool_args, tool_call_id="call_err")

    with pytest.raises(RuntimeError, match="boom: kaboom"):
        await wrapper.wrap_tool_execute(
            ctx, call=call, tool_def=explode_tool_def, args=tool_args, handler=handler
        )

    (span,) = in_memory_span_exporter.get_finished_spans()
    assert span.name == "explode"
    assert span.status.status_code == StatusCode.ERROR
    assert span.status.description == "RuntimeError: boom: kaboom"

    assert len(span.events) == 1
    (exception_event,) = span.events
    assert exception_event.name == "exception"
    exception_attributes = dict(exception_event.attributes or {})
    assert exception_attributes.pop("exception.type") == "RuntimeError"
    assert exception_attributes.pop("exception.message") == "boom: kaboom"
    assert isinstance(exception_attributes.pop("exception.stacktrace"), str)
    assert exception_attributes.pop("exception.escaped") == "False"
    assert not exception_attributes

    attributes = dict(span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == TOOL
    assert attributes.pop(TOOL_NAME) == "explode"
    assert attributes.pop(TOOL_DESCRIPTION) == "Always raises with the given reason."

    parameters = attributes.pop(TOOL_PARAMETERS)
    assert isinstance(parameters, str)
    assert json.loads(parameters) == {
        "type": "object",
        "properties": {"reason": {"type": "string"}},
        "required": ["reason"],
        "additionalProperties": False,
    }

    assert attributes.pop(TOOL_CALL_ID) == "call_err"

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    assert json.loads(input_value) == {"reason": "kaboom"}
    assert attributes.pop(INPUT_MIME_TYPE) == JSON

    assert OUTPUT_VALUE not in attributes
    assert not attributes


async def test_after_model_request_emits_native_tool_span_for_call_and_return(
    in_memory_span_exporter: InMemorySpanExporter,
    tracer: Tracer,
    make_ctx: Callable[..., RunContext[None]],
) -> None:
    wrapper = OpenInferenceCapabilityWrapper[None](
        wrapped=_NoOpCapability(),
        tracer=tracer,
    )
    return_timestamp = datetime(2026, 5, 21, 12, 0, 0, tzinfo=timezone.utc)
    response = ModelResponse(
        parts=[
            NativeToolCallPart(
                tool_name="web_search",
                args={"query": "phoenix tracing"},
                tool_call_id="native-call-1",
                provider_name="anthropic",
                provider_details={"latency_ms": 123},
            ),
            NativeToolReturnPart(
                tool_name="web_search",
                content="search results",
                tool_call_id="native-call-1",
                timestamp=return_timestamp,
            ),
        ],
    )
    ctx = make_ctx(tool_call_id=None, tool_name=None)
    request_context = ModelRequestContext(
        model=TestModel(),
        messages=[],
        model_settings=None,
        model_request_parameters=ModelRequestParameters(
            function_tools=[], native_tools=[], output_tools=[]
        ),
    )

    returned = await wrapper.after_model_request(
        ctx, request_context=request_context, response=response
    )
    assert returned is response

    (span,) = in_memory_span_exporter.get_finished_spans()
    assert span.name == "web_search"
    assert span.status.status_code == StatusCode.OK
    assert span.status.description is None
    assert span.events == ()

    attributes = dict(span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == TOOL
    assert attributes.pop(TOOL_NAME) == "web_search"
    assert attributes.pop(TOOL_CALL_ID) == "native-call-1"

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    assert json.loads(input_value) == {"query": "phoenix tracing"}
    assert attributes.pop(INPUT_MIME_TYPE) == JSON

    assert attributes.pop(OUTPUT_VALUE) == "search results"
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT

    assert not attributes


async def test_after_model_request_emits_native_tool_span_without_return_part(
    in_memory_span_exporter: InMemorySpanExporter,
    tracer: Tracer,
    make_ctx: Callable[..., RunContext[None]],
) -> None:
    wrapper = OpenInferenceCapabilityWrapper[None](
        wrapped=_NoOpCapability(),
        tracer=tracer,
    )
    response = ModelResponse(
        parts=[
            NativeToolCallPart(
                tool_name="web_search",
                args={"query": "phoenix tracing"},
                tool_call_id="native-call-1",
            ),
        ],
    )
    ctx = make_ctx(tool_call_id=None, tool_name=None)
    request_context = ModelRequestContext(
        model=TestModel(),
        messages=[],
        model_settings=None,
        model_request_parameters=ModelRequestParameters(
            function_tools=[], native_tools=[], output_tools=[]
        ),
    )

    await wrapper.after_model_request(ctx, request_context=request_context, response=response)

    (span,) = in_memory_span_exporter.get_finished_spans()
    assert span.name == "web_search"
    assert span.status.status_code == StatusCode.OK
    assert span.status.description is None
    assert span.events == ()

    attributes = dict(span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == TOOL
    assert attributes.pop(TOOL_NAME) == "web_search"
    assert attributes.pop(TOOL_CALL_ID) == "native-call-1"

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    assert json.loads(input_value) == {"query": "phoenix tracing"}
    assert attributes.pop(INPUT_MIME_TYPE) == JSON

    assert OUTPUT_VALUE not in attributes
    assert OUTPUT_MIME_TYPE not in attributes
    assert not attributes


async def test_after_model_request_records_error_for_failed_native_tool_return(
    in_memory_span_exporter: InMemorySpanExporter,
    tracer: Tracer,
    make_ctx: Callable[..., RunContext[None]],
) -> None:
    wrapper = OpenInferenceCapabilityWrapper[None](
        wrapped=_NoOpCapability(),
        tracer=tracer,
    )
    return_timestamp = datetime(2026, 5, 21, 12, 0, 0, tzinfo=timezone.utc)
    response = ModelResponse(
        parts=[
            NativeToolCallPart(
                tool_name="web_search",
                args={"query": "phoenix tracing"},
                tool_call_id="native-call-1",
            ),
            NativeToolReturnPart(
                tool_name="web_search",
                content="rate limit exceeded",
                tool_call_id="native-call-1",
                timestamp=return_timestamp,
                outcome="failed",
            ),
        ],
    )
    ctx = make_ctx(tool_call_id=None, tool_name=None)
    request_context = ModelRequestContext(
        model=TestModel(),
        messages=[],
        model_settings=None,
        model_request_parameters=ModelRequestParameters(
            function_tools=[], native_tools=[], output_tools=[]
        ),
    )

    await wrapper.after_model_request(ctx, request_context=request_context, response=response)

    (span,) = in_memory_span_exporter.get_finished_spans()
    assert span.name == "web_search"
    assert span.status.status_code == StatusCode.ERROR
    assert span.status.description is None

    attributes = dict(span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == TOOL
    assert attributes.pop(TOOL_NAME) == "web_search"
    assert attributes.pop(TOOL_CALL_ID) == "native-call-1"

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    assert json.loads(input_value) == {"query": "phoenix tracing"}
    assert attributes.pop(INPUT_MIME_TYPE) == JSON

    assert attributes.pop(OUTPUT_VALUE) == "rate limit exceeded"
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT

    assert not attributes

    (exception_event,) = span.events
    assert exception_event.name == "exception"
    exception_attributes = dict(exception_event.attributes or {})
    assert exception_attributes.pop("exception.type") == "Exception"
    assert exception_attributes.pop("exception.message") == "rate limit exceeded"
    stacktrace = exception_attributes.pop("exception.stacktrace")
    assert isinstance(stacktrace, str)
    assert "Exception: rate limit exceeded" in stacktrace
    assert exception_attributes.pop("exception.escaped") == "False"
    assert not exception_attributes


# OpenInference attribute keys
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
TOOL_NAME = SpanAttributes.TOOL_NAME
TOOL_DESCRIPTION = SpanAttributes.TOOL_DESCRIPTION
TOOL_PARAMETERS = SpanAttributes.TOOL_PARAMETERS
TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID
INPUT_VALUE = SpanAttributes.INPUT_VALUE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE

TOOL = OpenInferenceSpanKindValues.TOOL.value
JSON = OpenInferenceMimeTypeValues.JSON.value
TEXT = OpenInferenceMimeTypeValues.TEXT.value
