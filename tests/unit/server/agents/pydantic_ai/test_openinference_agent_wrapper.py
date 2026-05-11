from __future__ import annotations

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import pytest
from openinference.semconv.trace import (
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
)
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode
from pydantic_ai import Agent
from pydantic_ai.messages import ModelMessage, ModelResponse
from pydantic_ai.models import ModelRequestParameters, StreamedResponse
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.models.wrapper import WrapperModel
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.settings import ModelSettings

from phoenix.server.agents.pydantic_ai import (
    OpenInferenceAgentWrapper,
    OpenInferenceModelWrapper,
)
from tests.unit.vcr import CustomVCR


@pytest.fixture
def anthropic_api_key(monkeypatch: pytest.MonkeyPatch) -> str:
    api_key = "sk-0123456789"
    monkeypatch.setenv("ANTHROPIC_API_KEY", api_key)
    return api_key


@pytest.fixture
def in_memory_span_exporter() -> InMemorySpanExporter:
    return InMemorySpanExporter()


@pytest.fixture
def tracer_provider(in_memory_span_exporter: InMemorySpanExporter) -> TracerProvider:
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(in_memory_span_exporter))
    return provider


@pytest.fixture
def wrapped_model(
    tracer_provider: TracerProvider,
    anthropic_api_key: str,
) -> OpenInferenceModelWrapper:
    inner = AnthropicModel(MODEL_NAME, provider=AnthropicProvider())
    return OpenInferenceModelWrapper(inner, tracer_provider=tracer_provider)


@pytest.fixture
def wrapped_agent(
    wrapped_model: OpenInferenceModelWrapper,
    tracer_provider: TracerProvider,
) -> OpenInferenceAgentWrapper[None, str]:
    inner: Agent[None, str] = Agent(
        wrapped_model,
        name="TestAgent",
        deps_type=type(None),
        instructions=(
            "Reply with exactly the user's prompt verbatim and nothing else, "
            "no quotes, no extra punctuation."
        ),
    )
    return OpenInferenceAgentWrapper(inner, tracer_provider=tracer_provider)


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
def raising_agent(
    raising_model: WrapperModel,
    tracer_provider: TracerProvider,
) -> OpenInferenceAgentWrapper[None, str]:
    """An OpenInferenceAgentWrapper whose underlying model always raises."""
    inner: Agent[None, str] = Agent(raising_model, deps_type=type(None))
    return OpenInferenceAgentWrapper(inner, tracer_provider=tracer_provider)


def _get_agent_span(spans: tuple[ReadableSpan, ...]) -> ReadableSpan:
    matches = [
        span for span in spans if (span.attributes or {}).get(OPENINFERENCE_SPAN_KIND) == AGENT
    ]
    assert len(matches) == 1, f"expected 1 AGENT span, got {len(matches)}"
    return matches[0]


def _get_llm_spans(spans: tuple[ReadableSpan, ...]) -> list[ReadableSpan]:
    return [s for s in spans if (s.attributes or {}).get(OPENINFERENCE_SPAN_KIND) == LLM]


async def test_iter_emits_agent_span_for_text_response(
    wrapped_agent: OpenInferenceAgentWrapper[None, str],
    in_memory_span_exporter: InMemorySpanExporter,
    custom_vcr: CustomVCR,
) -> None:
    user_prompt = "The capital of France is Paris."
    model_settings = ModelSettings(temperature=0.0, max_tokens=32)

    with custom_vcr.use_cassette():
        async with wrapped_agent.iter(
            user_prompt,
            model_settings=model_settings,
        ) as agent_run:
            async for _ in agent_run:
                pass
        assert agent_run.result is not None
        assert agent_run.result.output == user_prompt

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    assert agent_span.name == "TestAgent.iter"
    assert agent_span.status.status_code == StatusCode.OK

    attributes = dict(agent_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == AGENT

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    parsed_input = json.loads(input_value)
    assert set(parsed_input) == {"user_prompt", "model_settings"}
    assert parsed_input["user_prompt"] == user_prompt
    assert parsed_input["model_settings"] == dict(model_settings)
    assert attributes.pop(INPUT_MIME_TYPE) == JSON

    assert attributes.pop(OUTPUT_VALUE) == user_prompt
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT

    assert not attributes

    llm_spans = _get_llm_spans(spans)
    assert len(llm_spans) == 1
    llm_span = llm_spans[0]
    assert llm_span.parent is not None
    assert llm_span.parent.span_id == agent_span.context.span_id


async def test_run_emits_agent_span_for_text_response(
    wrapped_agent: OpenInferenceAgentWrapper[None, str],
    in_memory_span_exporter: InMemorySpanExporter,
    custom_vcr: CustomVCR,
) -> None:
    user_prompt = "The quick brown fox jumps over the lazy dog."
    model_settings = ModelSettings(temperature=0.0, max_tokens=32)

    with custom_vcr.use_cassette():
        result = await wrapped_agent.run(
            user_prompt,
            model_settings=model_settings,
        )

    assert result.output == user_prompt

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    assert agent_span.name == "TestAgent.iter"
    assert agent_span.status.status_code == StatusCode.OK

    attributes = dict(agent_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == AGENT

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    parsed_input = json.loads(input_value)
    assert set(parsed_input) == {"user_prompt", "model_settings"}
    assert parsed_input["user_prompt"] == user_prompt
    assert parsed_input["model_settings"] == dict(model_settings)
    assert attributes.pop(INPUT_MIME_TYPE) == JSON

    assert attributes.pop(OUTPUT_VALUE) == user_prompt
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT

    assert not attributes

    llm_spans = _get_llm_spans(spans)
    assert len(llm_spans) == 1
    llm_span = llm_spans[0]
    assert llm_span.parent is not None
    assert llm_span.parent.span_id == agent_span.context.span_id


async def test_run_stream_emits_agent_span(
    wrapped_agent: OpenInferenceAgentWrapper[None, str],
    in_memory_span_exporter: InMemorySpanExporter,
    custom_vcr: CustomVCR,
) -> None:
    user_prompt = "Streaming spans across multiple deltas."
    model_settings = ModelSettings(temperature=0.0, max_tokens=32)

    with custom_vcr.use_cassette():
        async with wrapped_agent.run_stream(
            user_prompt,
            model_settings=model_settings,
        ) as stream:
            chunks: list[str] = []
            async for chunk in stream.stream_text(delta=True):
                chunks.append(chunk)
            final_output = await stream.get_output()

    assert final_output == user_prompt
    assert "".join(chunks) == user_prompt

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    assert agent_span.name == "TestAgent.iter"
    assert agent_span.status.status_code == StatusCode.OK

    attributes = dict(agent_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == AGENT

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    parsed_input = json.loads(input_value)
    assert parsed_input["user_prompt"] == user_prompt
    assert parsed_input["model_settings"] == dict(model_settings)
    assert attributes.pop(INPUT_MIME_TYPE) == JSON

    assert attributes.pop(OUTPUT_VALUE) == user_prompt
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT

    assert not attributes

    llm_spans = _get_llm_spans(spans)
    assert len(llm_spans) == 1
    llm_span = llm_spans[0]
    assert llm_span.parent is not None
    assert llm_span.parent.span_id == agent_span.context.span_id


async def test_iter_records_exception_when_run_fails(
    raising_agent: OpenInferenceAgentWrapper[None, str],
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

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    parsed_input = json.loads(input_value)
    assert parsed_input == {"user_prompt": "anything"}
    assert attributes.pop(INPUT_MIME_TYPE) == JSON

    assert not attributes


# OpenInference attribute keys
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
INPUT_VALUE = SpanAttributes.INPUT_VALUE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE

AGENT = OpenInferenceSpanKindValues.AGENT.value
LLM = OpenInferenceSpanKindValues.LLM.value
JSON = OpenInferenceMimeTypeValues.JSON.value
TEXT = OpenInferenceMimeTypeValues.TEXT.value

MODEL_NAME = "claude-haiku-4-5"
