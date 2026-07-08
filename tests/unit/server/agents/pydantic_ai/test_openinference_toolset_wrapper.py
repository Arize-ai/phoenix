from __future__ import annotations

import json
from typing import Callable

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
from pydantic_ai.models.test import TestModel
from pydantic_ai.toolsets import FunctionToolset
from pydantic_ai.usage import RunUsage

from phoenix.server.agents.pydantic_ai import OpenInferenceToolsetWrapper


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
def add_toolset() -> FunctionToolset[None]:
    toolset: FunctionToolset[None] = FunctionToolset()

    @toolset.tool_plain
    def add(a: int, b: int) -> int:
        """Add two integers."""
        return a + b

    return toolset


@pytest.fixture
def raising_toolset() -> FunctionToolset[None]:
    toolset: FunctionToolset[None] = FunctionToolset()

    @toolset.tool_plain
    def explode(reason: str) -> str:
        """Always raises with the given reason."""
        raise RuntimeError(f"boom: {reason}")

    return toolset


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


async def test_call_tool_emits_tool_span(
    add_toolset: FunctionToolset[None],
    in_memory_span_exporter: InMemorySpanExporter,
    tracer: Tracer,
    make_ctx: Callable[..., RunContext[None]],
) -> None:
    wrapped_toolset = OpenInferenceToolsetWrapper(add_toolset, tracer=tracer)
    tool_args = {"a": 2, "b": 3}

    async with wrapped_toolset:
        ctx = make_ctx(tool_call_id="call_42", tool_name="add")
        tools = await wrapped_toolset.get_tools(ctx)
        result = await wrapped_toolset.call_tool("add", tool_args, ctx, tools["add"])

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


async def test_call_tool_records_exception_when_tool_raises(
    raising_toolset: FunctionToolset[None],
    in_memory_span_exporter: InMemorySpanExporter,
    tracer: Tracer,
    make_ctx: Callable[..., RunContext[None]],
) -> None:
    wrapped_toolset = OpenInferenceToolsetWrapper(raising_toolset, tracer=tracer)

    async with wrapped_toolset:
        ctx = make_ctx(tool_call_id="call_err", tool_name="explode")
        tools = await wrapped_toolset.get_tools(ctx)
        with pytest.raises(RuntimeError, match="boom: kaboom"):
            await wrapped_toolset.call_tool("explode", {"reason": "kaboom"}, ctx, tools["explode"])

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
