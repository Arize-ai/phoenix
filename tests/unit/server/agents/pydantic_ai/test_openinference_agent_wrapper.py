from __future__ import annotations

import json
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import pytest
from openinference.instrumentation import OITracer, TraceConfig
from openinference.semconv.trace import (
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolCallAttributes,
)
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode, Tracer
from pydantic_ai import Agent
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    NativeToolCallPart,
    NativeToolReturnPart,
    TextPart,
    ThinkingPart,
    UserPromptPart,
)
from pydantic_ai.models import ModelRequestParameters, StreamedResponse
from pydantic_ai.models.test import TestModel
from pydantic_ai.models.wrapper import WrapperModel
from pydantic_ai.settings import ModelSettings

from phoenix.server.agents.pydantic_ai import (
    OpenInferenceAgentWrapper,
    OpenInferenceCapabilityWrapper,
    OpenInferenceModelWrapper,
)


@dataclass
class _NoOpCapability(AbstractCapability[Any]):
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
def tracer(tracer_provider: TracerProvider) -> OITracer:
    return OITracer(tracer_provider.get_tracer("test"), config=TraceConfig())


@pytest.fixture
def wrapped_model(tracer: Tracer) -> OpenInferenceModelWrapper:
    inner = TestModel(custom_output_text=MODEL_OUTPUT_TEXT)
    return OpenInferenceModelWrapper(inner, tracer=tracer)


@pytest.fixture
def wrapped_agent(
    wrapped_model: OpenInferenceModelWrapper,
    tracer: Tracer,
) -> OpenInferenceAgentWrapper[None, str]:
    inner: Agent[None, str] = Agent(
        wrapped_model,
        name="TestAgent",
        deps_type=type(None),
    )
    return OpenInferenceAgentWrapper[None, str](inner, tracer=tracer)


@pytest.fixture
def raising_model() -> WrapperModel:
    """A model that always raises on request, used to exercise the wrapper's
    exception-handling path without hitting the network."""

    class _RaisingWrapperModel(WrapperModel):
        async def request(
            self,
            messages: list[ModelMessage],
            model_settings: ModelSettings | None,
            model_request_parameters: ModelRequestParameters,
        ) -> ModelResponse:
            raise RuntimeError("boom from raising model")

        @asynccontextmanager
        async def request_stream(
            self,
            messages: list[ModelMessage],
            model_settings: ModelSettings | None,
            model_request_parameters: ModelRequestParameters,
            run_context: Any = None,
        ) -> AsyncIterator[StreamedResponse]:
            raise RuntimeError("boom from raising model")
            yield  # pragma: no cover

    return _RaisingWrapperModel(TestModel())


@pytest.fixture
def native_tool_agent(tracer: Tracer) -> OpenInferenceAgentWrapper[None, str]:
    class _NativeToolModel(WrapperModel):
        async def request(
            self,
            messages: list[ModelMessage],
            model_settings: ModelSettings | None,
            model_request_parameters: ModelRequestParameters,
        ) -> ModelResponse:
            return ModelResponse(
                parts=[
                    NativeToolCallPart(
                        tool_name="web_search",
                        args={"query": "phoenix tracing"},
                        tool_call_id="native-call-1",
                        provider_name="openai",
                        provider_details={"type": "web_search_call"},
                    ),
                    NativeToolReturnPart(
                        tool_name="web_search",
                        content={"results": [{"title": "Phoenix"}]},
                        tool_call_id="native-call-1",
                        provider_name="openai",
                        provider_details={"status": "completed"},
                        timestamp=datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc),
                    ),
                    TextPart(content="I found Phoenix tracing documentation."),
                ]
            )

        @asynccontextmanager
        async def request_stream(
            self,
            messages: list[ModelMessage],
            model_settings: ModelSettings | None,
            model_request_parameters: ModelRequestParameters,
            run_context: Any = None,
        ) -> AsyncIterator[StreamedResponse]:
            raise RuntimeError("streaming is not used")
            yield  # pragma: no cover

    inner: Agent[None, str] = Agent(
        OpenInferenceModelWrapper(_NativeToolModel(TestModel()), tracer=tracer),
        name="NativeToolAgent",
        deps_type=type(None),
        capabilities=[
            OpenInferenceCapabilityWrapper[None](wrapped=_NoOpCapability(), tracer=tracer)
        ],
    )
    return OpenInferenceAgentWrapper[None, str](inner, tracer=tracer)


@pytest.fixture
def raising_agent(
    raising_model: WrapperModel,
    tracer: Tracer,
) -> OpenInferenceAgentWrapper[None, str]:
    """An OpenInferenceAgentWrapper whose underlying model always raises."""
    inner: Agent[None, str] = Agent(raising_model, deps_type=type(None))
    return OpenInferenceAgentWrapper[None, str](inner, tracer=tracer)


@pytest.fixture
def test_model_agent(
    tracer: Tracer,
) -> OpenInferenceAgentWrapper[None, str]:
    """An OpenInferenceAgentWrapper backed by TestModel — no network, no VCR.

    Used by tests that exercise behavior triggered by the inbound history
    (e.g. external tool span backfill) and don't care about model output.
    """
    inner: Agent[None, str] = Agent(TestModel(), deps_type=type(None))
    return OpenInferenceAgentWrapper[None, str](inner, tracer=tracer)


def _get_agent_span(spans: tuple[ReadableSpan, ...]) -> ReadableSpan:
    matches = [
        span for span in spans if (span.attributes or {}).get(OPENINFERENCE_SPAN_KIND) == AGENT
    ]
    assert len(matches) == 1, f"expected 1 AGENT span, got {len(matches)}"
    return matches[0]


def _get_llm_spans(spans: tuple[ReadableSpan, ...]) -> list[ReadableSpan]:
    return [s for s in spans if (s.attributes or {}).get(OPENINFERENCE_SPAN_KIND) == LLM]


def _get_tool_spans(spans: tuple[ReadableSpan, ...]) -> list[ReadableSpan]:
    return [s for s in spans if (s.attributes or {}).get(OPENINFERENCE_SPAN_KIND) == TOOL]


@pytest.fixture
def make_agent_with_response_parts(
    tracer: Tracer,
) -> Callable[[list[Any]], OpenInferenceAgentWrapper[None, str]]:
    def _make_agent_with_response_parts(parts: list[Any]) -> OpenInferenceAgentWrapper[None, str]:
        class _StaticResponseModel(WrapperModel):
            async def request(
                self,
                messages: list[ModelMessage],
                model_settings: ModelSettings | None,
                model_request_parameters: ModelRequestParameters,
            ) -> ModelResponse:
                return ModelResponse(parts=parts)

        inner: Agent[None, str] = Agent(
            OpenInferenceModelWrapper(_StaticResponseModel(TestModel()), tracer=tracer),
            name="StaticResponseAgent",
            deps_type=type(None),
        )
        return OpenInferenceAgentWrapper[None, str](inner, tracer=tracer)

    return _make_agent_with_response_parts


async def test_iter_emits_agent_span_for_text_response(
    wrapped_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    user_prompt = "The capital of France is Paris."
    model_settings = ModelSettings(temperature=0.0, max_tokens=32)

    async with wrapped_agent.iter(
        user_prompt,
        model_settings=model_settings,
    ) as agent_run:
        async for _ in agent_run:
            pass
    assert agent_run.result is not None
    assert agent_run.result.output == MODEL_OUTPUT_TEXT

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    assert agent_span.name == "TestAgent.iter"
    assert agent_span.status.status_code == StatusCode.OK

    attributes = dict(agent_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == AGENT

    assert attributes.pop(INPUT_VALUE) == user_prompt
    assert attributes.pop(INPUT_MIME_TYPE) == TEXT

    assert attributes.pop(OUTPUT_VALUE) == MODEL_OUTPUT_TEXT
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT

    metadata_value = attributes.pop(METADATA)
    assert isinstance(metadata_value, str)
    metadata = json.loads(metadata_value)
    assert metadata["input"]["user_prompt"] == user_prompt
    assert metadata["input"]["model_settings"] == dict(model_settings)
    assert metadata["output"] == MODEL_OUTPUT_TEXT

    assert not attributes

    llm_spans = _get_llm_spans(spans)
    assert len(llm_spans) == 1
    llm_span = llm_spans[0]
    assert llm_span.parent is not None
    assert llm_span.parent.span_id == agent_span.context.span_id


async def test_iter_uses_explicit_span_name_override(
    wrapped_model: OpenInferenceModelWrapper,
    tracer: Tracer,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    """``span_name`` overrides the default ``{agent name}.iter`` naming."""
    inner: Agent[None, str] = Agent(wrapped_model, name="TestAgent", deps_type=type(None))
    agent = OpenInferenceAgentWrapper[None, str](inner, tracer=tracer, span_name="pxi.iter.server")

    async with agent.iter("hello") as agent_run:
        async for _ in agent_run:
            pass

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    assert agent_span.name == "pxi.iter.server"


async def test_agent_span_filters_empty_thinking_for_single_text_output(
    make_agent_with_response_parts: Callable[[list[Any]], OpenInferenceAgentWrapper],
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    wrapped_agent = make_agent_with_response_parts(
        [ThinkingPart(content=""), TextPart(content="Visible answer.")]
    )

    result = await wrapped_agent.run("question")

    assert result.output == "Visible answer."
    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    attributes = dict(agent_span.attributes or {})
    assert attributes.pop(OUTPUT_VALUE) == "Visible answer."
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT


async def test_agent_span_serializes_multiple_text_blocks_as_json_array(
    make_agent_with_response_parts: Callable[[list[Any]], OpenInferenceAgentWrapper],
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    wrapped_agent = make_agent_with_response_parts(
        [
            ThinkingPart(content=""),
            TextPart(content="First block."),
            TextPart(content="Second block."),
        ]
    )

    await wrapped_agent.run("question")

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    attributes = dict(agent_span.attributes or {})
    output_value = attributes.pop(OUTPUT_VALUE)
    assert isinstance(output_value, str)
    parsed_output = json.loads(output_value)
    assert parsed_output == [
        {"content": "First block.", "part_kind": "text"},
        {"content": "Second block.", "part_kind": "text"},
    ]
    assert attributes.pop(OUTPUT_MIME_TYPE) == JSON


async def test_run_emits_agent_span_for_text_response(
    wrapped_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    user_prompt = "The quick brown fox jumps over the lazy dog."
    model_settings = ModelSettings(temperature=0.0, max_tokens=32)

    result = await wrapped_agent.run(
        user_prompt,
        model_settings=model_settings,
    )

    assert result.output == MODEL_OUTPUT_TEXT

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    assert agent_span.name == "TestAgent.iter"
    assert agent_span.status.status_code == StatusCode.OK

    attributes = dict(agent_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == AGENT

    assert attributes.pop(INPUT_VALUE) == user_prompt
    assert attributes.pop(INPUT_MIME_TYPE) == TEXT

    assert attributes.pop(OUTPUT_VALUE) == MODEL_OUTPUT_TEXT
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT

    metadata_value = attributes.pop(METADATA)
    assert isinstance(metadata_value, str)
    metadata = json.loads(metadata_value)
    assert metadata["input"]["user_prompt"] == user_prompt
    assert metadata["input"]["model_settings"] == dict(model_settings)
    assert metadata["output"] == MODEL_OUTPUT_TEXT

    assert not attributes

    llm_spans = _get_llm_spans(spans)
    assert len(llm_spans) == 1
    llm_span = llm_spans[0]
    assert llm_span.parent is not None
    assert llm_span.parent.span_id == agent_span.context.span_id


async def test_run_stream_emits_agent_span(
    wrapped_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    user_prompt = "Streaming spans across multiple deltas."
    model_settings = ModelSettings(temperature=0.0, max_tokens=32)

    async with wrapped_agent.run_stream(
        user_prompt,
        model_settings=model_settings,
    ) as stream:
        chunks: list[str] = []
        async for chunk in stream.stream_text(delta=True):
            chunks.append(chunk)
        final_output = await stream.get_output()

    assert final_output == MODEL_OUTPUT_TEXT
    assert "".join(chunks) == MODEL_OUTPUT_TEXT

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    assert agent_span.name == "TestAgent.iter"
    assert agent_span.status.status_code == StatusCode.OK

    attributes = dict(agent_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == AGENT

    assert attributes.pop(INPUT_VALUE) == user_prompt
    assert attributes.pop(INPUT_MIME_TYPE) == TEXT

    assert attributes.pop(OUTPUT_VALUE) == MODEL_OUTPUT_TEXT
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT

    metadata_value = attributes.pop(METADATA)
    assert isinstance(metadata_value, str)
    metadata = json.loads(metadata_value)
    assert metadata["input"]["user_prompt"] == user_prompt
    assert metadata["input"]["model_settings"] == dict(model_settings)
    assert metadata["output"] == MODEL_OUTPUT_TEXT

    assert not attributes

    llm_spans = _get_llm_spans(spans)
    assert len(llm_spans) == 1
    llm_span = llm_spans[0]
    assert llm_span.parent is not None
    assert llm_span.parent.span_id == agent_span.context.span_id


async def test_iter_records_exception_when_run_fails(
    raising_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    with pytest.raises(RuntimeError, match="boom from raising model"):
        async with raising_agent.iter("anything") as agent_run:
            async for _ in agent_run:
                pass

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    assert agent_span.status.status_code == StatusCode.ERROR
    assert agent_span.status.description == "RuntimeError: boom from raising model"

    assert len(agent_span.events) == 1
    (exception_event,) = agent_span.events
    assert exception_event.name == "exception"
    exception_attributes = dict(exception_event.attributes or {})
    assert exception_attributes.pop("exception.type") == "RuntimeError"
    assert exception_attributes.pop("exception.message") == "boom from raising model"
    assert isinstance(exception_attributes.pop("exception.stacktrace"), str)
    assert exception_attributes.pop("exception.escaped") == "False"
    assert not exception_attributes

    attributes = dict(agent_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == AGENT

    assert attributes.pop(INPUT_VALUE) == "anything"
    assert attributes.pop(INPUT_MIME_TYPE) == TEXT

    metadata_value = attributes.pop(METADATA)
    assert isinstance(metadata_value, str)
    metadata = json.loads(metadata_value)
    assert metadata == {"input": {"user_prompt": "anything", "message_history": None}}

    assert not attributes


async def test_does_not_emit_tool_spans_for_history_ending_in_user_prompt(
    test_model_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    history: list[ModelMessage] = [
        ModelRequest(parts=[UserPromptPart(content="hi")]),
        ModelResponse(parts=[TextPart(content="hello")]),
        ModelRequest(parts=[UserPromptPart(content="another question")]),
    ]
    await test_model_agent.run("continue", message_history=history)

    spans = in_memory_span_exporter.get_finished_spans()
    assert _get_tool_spans(spans) == []


async def test_emits_tool_span_for_provider_native_tool(
    native_tool_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    result = await native_tool_agent.run("search the web")
    assert result.output == "I found Phoenix tracing documentation."

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    tool_spans = _get_tool_spans(spans)
    assert len(tool_spans) == 1
    tool_span = tool_spans[0]
    assert tool_span.name == "web_search"
    assert tool_span.parent is not None
    assert tool_span.parent.span_id == agent_span.context.span_id
    assert tool_span.context.trace_id == agent_span.context.trace_id
    assert tool_span.status.status_code == StatusCode.OK

    agent_attributes = dict(agent_span.attributes or {})
    output_value = agent_attributes.pop(OUTPUT_VALUE)
    assert isinstance(output_value, str)
    parsed_output = json.loads(output_value)
    assert parsed_output == [
        {
            "args": {"query": "phoenix tracing"},
            "part_kind": "builtin-tool-call",
            "provider_details": {"type": "web_search_call"},
            "provider_name": "openai",
            "tool_call_id": "native-call-1",
            "tool_name": "web_search",
        },
        {
            "content": {"results": [{"title": "Phoenix"}]},
            "outcome": "success",
            "part_kind": "builtin-tool-return",
            "provider_details": {"status": "completed"},
            "provider_name": "openai",
            "timestamp": "2026-01-02T03:04:05Z",
            "tool_call_id": "native-call-1",
            "tool_name": "web_search",
        },
        {
            "content": "I found Phoenix tracing documentation.",
            "part_kind": "text",
        },
    ]
    assert agent_attributes.pop(OUTPUT_MIME_TYPE) == JSON

    attributes = dict(tool_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == TOOL
    assert attributes.pop(TOOL_NAME) == "web_search"
    assert attributes.pop(TOOL_CALL_ID) == "native-call-1"
    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    assert json.loads(input_value) == {"query": "phoenix tracing"}
    assert attributes.pop(INPUT_MIME_TYPE) == JSON
    output_value = attributes.pop(OUTPUT_VALUE)
    assert isinstance(output_value, str)
    assert json.loads(output_value) == {"results": [{"title": "Phoenix"}]}
    assert attributes.pop(OUTPUT_MIME_TYPE) == JSON
    assert not attributes


# OpenInference attribute keys
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
INPUT_VALUE = SpanAttributes.INPUT_VALUE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
METADATA = SpanAttributes.METADATA

AGENT = OpenInferenceSpanKindValues.AGENT.value
LLM = OpenInferenceSpanKindValues.LLM.value
TOOL = OpenInferenceSpanKindValues.TOOL.value
JSON = OpenInferenceMimeTypeValues.JSON.value
TEXT = OpenInferenceMimeTypeValues.TEXT.value

TOOL_NAME = SpanAttributes.TOOL_NAME
TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID

MODEL_OUTPUT_TEXT = "Bonjour, le monde."
