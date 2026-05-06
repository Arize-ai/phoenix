from __future__ import annotations

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import pytest
from openinference.semconv.trace import (
    MessageAttributes,
    OpenInferenceLLMProviderValues,
    OpenInferenceLLMSystemValues,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolAttributes,
    ToolCallAttributes,
)
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    PartDeltaEvent,
    PartStartEvent,
    SystemPromptPart,
    TextPart,
    TextPartDelta,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models import ModelRequestParameters, StreamedResponse
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.models.wrapper import WrapperModel
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.settings import ModelSettings
from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.pydantic_ai import OpenInferenceModelWrapper
from tests.unit.vcr import CustomVCR


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
def raising_model(tracer_provider: TracerProvider) -> OpenInferenceModelWrapper:
    """An OpenInferenceModelWrapper whose underlying model raises on request,
    used to exercise the wrapper's exception-handling path without hitting the
    network."""

    class _RaisingModel(WrapperModel):
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

    return OpenInferenceModelWrapper(_RaisingModel(TestModel()), tracer_provider=tracer_provider)


async def test_request_emits_llm_span_for_text_response(
    wrapped_model: OpenInferenceModelWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
    custom_vcr: CustomVCR,
) -> None:
    expected_output = "The capital of France is Paris."
    messages: list[ModelMessage] = [
        ModelRequest(
            parts=[
                SystemPromptPart(
                    content=(
                        "Reply with exactly the following sentence and nothing else: "
                        f"{expected_output}"
                    )
                ),
                UserPromptPart(content="What is the capital of France?"),
            ]
        )
    ]
    settings = ModelSettings(temperature=0.0, max_tokens=32)

    with custom_vcr.use_cassette():
        response = await wrapped_model.request(
            messages=messages,
            model_settings=settings,
            model_request_parameters=ModelRequestParameters(
                function_tools=[], builtin_tools=[], output_tools=[]
            ),
        )

    assert response.parts, "model returned no parts"
    response_text = "".join(p.content for p in response.parts if isinstance(p, TextPart))
    assert response_text == expected_output

    spans = in_memory_span_exporter.get_finished_spans()
    assert len(spans) == 1
    span = spans[0]
    assert span.name == MODEL_NAME
    assert span.status.status_code == StatusCode.OK
    attributes = dict(span.attributes or {})

    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
    assert attributes.pop(LLM_PROVIDER) == PROVIDER_ANTHROPIC
    assert attributes.pop(LLM_SYSTEM) == SYSTEM_ANTHROPIC
    assert attributes.pop(LLM_MODEL_NAME) == MODEL_NAME
    inv_params = attributes.pop(LLM_INVOCATION_PARAMETERS)
    assert isinstance(inv_params, str)
    assert json.loads(inv_params) == dict(settings)

    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "system"
    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}") == (
        f"Reply with exactly the following sentence and nothing else: {expected_output}"
    )
    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_ROLE}") == "user"
    assert (
        attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_CONTENT}")
        == "What is the capital of France?"
    )

    assert attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}") == expected_output
    assert attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "assistant"

    assert isinstance(prompt_tokens := attributes.pop(LLM_TOKEN_COUNT_PROMPT), int)
    assert isinstance(completion_tokens := attributes.pop(LLM_TOKEN_COUNT_COMPLETION), int)
    assert prompt_tokens > 0
    assert completion_tokens > 0
    assert attributes.pop(LLM_TOKEN_COUNT_TOTAL) == prompt_tokens + completion_tokens

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    parsed_input = json.loads(input_value)
    assert set(parsed_input) == {"messages", "model_settings", "model_request_parameters"}

    parsed_messages = parsed_input["messages"]
    assert len(parsed_messages) == 1
    parsed_request = parsed_messages[0]
    assert parsed_request["kind"] == "request"
    parsed_parts = parsed_request["parts"]
    assert len(parsed_parts) == 2
    assert parsed_parts[0]["part_kind"] == "system-prompt"
    assert parsed_parts[0]["content"] == (
        f"Reply with exactly the following sentence and nothing else: {expected_output}"
    )
    assert parsed_parts[1]["part_kind"] == "user-prompt"
    assert parsed_parts[1]["content"] == "What is the capital of France?"

    assert parsed_input["model_settings"] == dict(settings)

    parsed_params = parsed_input["model_request_parameters"]
    assert parsed_params["function_tools"] == []
    assert parsed_params["builtin_tools"] == []
    assert parsed_params["output_tools"] == []
    assert parsed_params["allow_text_output"] is True

    assert attributes.pop(INPUT_MIME_TYPE) == JSON

    output_value = attributes.pop(OUTPUT_VALUE)
    assert isinstance(output_value, str)
    parsed_output = json.loads(output_value)
    assert parsed_output["kind"] == "response"
    output_parts = parsed_output["parts"]
    assert len(output_parts) == 1
    assert output_parts[0]["part_kind"] == "text"
    assert output_parts[0]["content"] == expected_output
    assert parsed_output["usage"]["input_tokens"] == prompt_tokens
    assert parsed_output["usage"]["output_tokens"] == completion_tokens
    assert attributes.pop(OUTPUT_MIME_TYPE) == JSON

    assert not attributes


async def test_request_emits_llm_span_for_tool_call_response(
    wrapped_model: OpenInferenceModelWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
    custom_vcr: CustomVCR,
) -> None:
    weather_tool = ToolDefinition(
        name="get_weather",
        description="Look up the current weather for a city.",
        parameters_json_schema={
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    )
    messages: list[ModelMessage] = [
        ModelRequest(
            parts=[
                SystemPromptPart(
                    content=("You must call the get_weather tool. Do not answer in text.")
                ),
                UserPromptPart(content="What's the weather in Paris?"),
            ]
        )
    ]
    settings = ModelSettings(max_tokens=256)

    with custom_vcr.use_cassette():
        response = await wrapped_model.request(
            messages=messages,
            model_settings=settings,
            model_request_parameters=ModelRequestParameters(
                function_tools=[weather_tool], builtin_tools=[], output_tools=[]
            ),
        )

    tool_call_parts = [part for part in response.parts if isinstance(part, ToolCallPart)]
    assert len(tool_call_parts) == 1
    tool_call_part = tool_call_parts[0]
    assert tool_call_part.tool_name == "get_weather"
    assert tool_call_part.args == {"city": "Paris"}
    assert tool_call_part.tool_call_id

    spans = in_memory_span_exporter.get_finished_spans()
    assert len(spans) == 1
    attributes = dict(spans[0].attributes or {})

    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
    assert attributes.pop(LLM_PROVIDER) == PROVIDER_ANTHROPIC
    assert attributes.pop(LLM_SYSTEM) == SYSTEM_ANTHROPIC
    assert attributes.pop(LLM_MODEL_NAME) == MODEL_NAME
    inv_params = attributes.pop(LLM_INVOCATION_PARAMETERS)
    assert isinstance(inv_params, str)
    assert json.loads(inv_params) == dict(settings)

    tool_schema_attr = attributes.pop(f"{LLM_TOOLS}.0.{TOOL_JSON_SCHEMA}")
    assert isinstance(tool_schema_attr, str)
    tool_schema = json.loads(tool_schema_attr)
    assert tool_schema["title"] == "get_weather"
    assert tool_schema["description"] == "Look up the current weather for a city."
    assert tool_schema["required"] == ["city"]

    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "system"
    assert isinstance(attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}"), str)
    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_ROLE}") == "user"
    assert (
        attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_CONTENT}")
        == "What's the weather in Paris?"
    )

    assert attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "assistant"
    tool_call_id = attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_ID}")
    assert tool_call_id == tool_call_part.tool_call_id
    assert (
        attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_NAME}")
        == "get_weather"
    )
    args_attr = attributes.pop(
        f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}"
    )
    assert isinstance(args_attr, str)
    assert json.loads(args_attr) == {"city": "Paris"}

    assert isinstance(prompt_tokens := attributes.pop(LLM_TOKEN_COUNT_PROMPT), int)
    assert isinstance(completion_tokens := attributes.pop(LLM_TOKEN_COUNT_COMPLETION), int)
    assert attributes.pop(LLM_TOKEN_COUNT_TOTAL) == prompt_tokens + completion_tokens

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    assert (
        json.loads(input_value)["model_request_parameters"]["function_tools"][0]["name"]
        == "get_weather"
    )
    assert attributes.pop(INPUT_MIME_TYPE) == JSON
    output_value = attributes.pop(OUTPUT_VALUE)
    assert isinstance(output_value, str)
    parsed_output = json.loads(output_value)
    assert any(part.get("tool_name") == "get_weather" for part in parsed_output["parts"])
    assert attributes.pop(OUTPUT_MIME_TYPE) == JSON

    assert not attributes


async def test_request_stream_emits_llm_span(
    wrapped_model: OpenInferenceModelWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
    custom_vcr: CustomVCR,
) -> None:
    expected_output = "The quick brown fox jumps over the lazy dog."
    user_prompt = f"Repeat exactly the following sentence and nothing else: {expected_output}"
    messages: list[ModelMessage] = [ModelRequest(parts=[UserPromptPart(content=user_prompt)])]
    settings = ModelSettings(max_tokens=32, temperature=0.0)

    with custom_vcr.use_cassette():
        async with wrapped_model.request_stream(
            messages=messages,
            model_settings=settings,
            model_request_parameters=ModelRequestParameters(
                function_tools=[], builtin_tools=[], output_tools=[]
            ),
            run_context=None,
        ) as stream:
            event_text_chunks: list[str] = []
            async for event in stream:
                if isinstance(event, PartStartEvent) and isinstance(event.part, TextPart):
                    event_text_chunks.append(event.part.content)
                elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                    event_text_chunks.append(event.delta.content_delta)
        final_response = stream.get()

    streamed_text = "".join(p.content for p in final_response.parts if isinstance(p, TextPart))
    assert streamed_text == expected_output
    assert "".join(event_text_chunks) == expected_output

    spans = in_memory_span_exporter.get_finished_spans()
    assert len(spans) == 1
    span = spans[0]
    assert span.name == MODEL_NAME
    assert span.status.status_code == StatusCode.OK
    attributes = dict(span.attributes or {})

    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
    assert attributes.pop(LLM_PROVIDER) == PROVIDER_ANTHROPIC
    assert attributes.pop(LLM_SYSTEM) == SYSTEM_ANTHROPIC
    assert attributes.pop(LLM_MODEL_NAME) == MODEL_NAME
    inv_params = attributes.pop(LLM_INVOCATION_PARAMETERS)
    assert isinstance(inv_params, str)
    assert json.loads(inv_params) == dict(settings)

    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "user"
    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}") == user_prompt

    assert attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "assistant"
    assert attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}") == expected_output

    assert isinstance(prompt_tokens := attributes.pop(LLM_TOKEN_COUNT_PROMPT), int)
    assert isinstance(completion_tokens := attributes.pop(LLM_TOKEN_COUNT_COMPLETION), int)
    assert attributes.pop(LLM_TOKEN_COUNT_TOTAL) == prompt_tokens + completion_tokens

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    parsed_input = json.loads(input_value)
    assert set(parsed_input) == {"messages", "model_settings", "model_request_parameters"}

    parsed_messages = parsed_input["messages"]
    assert len(parsed_messages) == 1
    parsed_request = parsed_messages[0]
    assert parsed_request["kind"] == "request"
    parsed_parts = parsed_request["parts"]
    assert len(parsed_parts) == 1
    assert parsed_parts[0]["part_kind"] == "user-prompt"
    assert parsed_parts[0]["content"] == user_prompt

    assert parsed_input["model_settings"] == dict(settings)

    parsed_params = parsed_input["model_request_parameters"]
    assert parsed_params["function_tools"] == []
    assert parsed_params["builtin_tools"] == []
    assert parsed_params["output_tools"] == []
    assert parsed_params["allow_text_output"] is True

    assert attributes.pop(INPUT_MIME_TYPE) == JSON

    output_value = attributes.pop(OUTPUT_VALUE)
    assert isinstance(output_value, str)
    parsed_output = json.loads(output_value)
    assert parsed_output["kind"] == "response"
    output_parts = parsed_output["parts"]
    assert len(output_parts) == 1
    assert output_parts[0]["part_kind"] == "text"
    assert output_parts[0]["content"] == expected_output
    assert parsed_output["usage"]["input_tokens"] == prompt_tokens
    assert parsed_output["usage"]["output_tokens"] == completion_tokens
    assert attributes.pop(OUTPUT_MIME_TYPE) == JSON

    assert not attributes


async def test_request_emits_tool_return_message_in_history(
    wrapped_model: OpenInferenceModelWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
    custom_vcr: CustomVCR,
) -> None:
    """Round-trip test: feed back a tool result and assert the prior tool
    return surfaces as a ``tool`` role input message on the next LLM span."""
    weather_tool = ToolDefinition(
        name="get_weather",
        description="Look up the current weather for a city.",
        parameters_json_schema={
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    )
    history: list[ModelMessage] = [
        ModelRequest(
            parts=[
                SystemPromptPart(content="Use the tool then summarize."),
                UserPromptPart(content="Weather in Paris?"),
            ]
        ),
        ModelResponse(
            parts=[
                ToolCallPart(
                    tool_name="get_weather",
                    args={"city": "Paris"},
                    tool_call_id="toolu_test_1",
                )
            ]
        ),
        ModelRequest(
            parts=[
                ToolReturnPart(
                    tool_name="get_weather",
                    content="sunny, 20C",
                    tool_call_id="toolu_test_1",
                )
            ]
        ),
    ]

    settings = ModelSettings(max_tokens=64)
    with custom_vcr.use_cassette():
        response = await wrapped_model.request(
            messages=history,
            model_settings=settings,
            model_request_parameters=ModelRequestParameters(
                function_tools=[weather_tool], builtin_tools=[], output_tools=[]
            ),
        )

    response_text = "".join(p.content for p in response.parts if isinstance(p, TextPart))
    assert response_text

    spans = in_memory_span_exporter.get_finished_spans()
    assert len(spans) == 1
    span = spans[0]
    assert span.name == MODEL_NAME
    assert span.status.status_code == StatusCode.OK
    attributes = dict(span.attributes or {})

    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
    assert attributes.pop(LLM_PROVIDER) == PROVIDER_ANTHROPIC
    assert attributes.pop(LLM_SYSTEM) == SYSTEM_ANTHROPIC
    assert attributes.pop(LLM_MODEL_NAME) == MODEL_NAME
    inv_params = attributes.pop(LLM_INVOCATION_PARAMETERS)
    assert isinstance(inv_params, str)
    assert json.loads(inv_params) == dict(settings)

    tool_schema_attr = attributes.pop(f"{LLM_TOOLS}.0.{TOOL_JSON_SCHEMA}")
    assert isinstance(tool_schema_attr, str)
    tool_schema = json.loads(tool_schema_attr)
    assert tool_schema["title"] == "get_weather"
    assert tool_schema["description"] == "Look up the current weather for a city."
    assert tool_schema["required"] == ["city"]

    # Message 0: system prompt.
    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "system"
    assert (
        attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}")
        == "Use the tool then summarize."
    )
    # Message 1: user prompt.
    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_ROLE}") == "user"
    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_CONTENT}") == "Weather in Paris?"
    # Message 2: assistant tool call.
    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.2.{MESSAGE_ROLE}") == "assistant"
    assert (
        attributes.pop(f"{LLM_INPUT_MESSAGES}.2.{MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_ID}")
        == "toolu_test_1"
    )
    assert (
        attributes.pop(f"{LLM_INPUT_MESSAGES}.2.{MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_NAME}")
        == "get_weather"
    )
    args_attr = attributes.pop(
        f"{LLM_INPUT_MESSAGES}.2.{MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}"
    )
    assert isinstance(args_attr, str)
    assert json.loads(args_attr) == {"city": "Paris"}
    # Message 3: tool return.
    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.3.{MESSAGE_ROLE}") == "tool"
    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.3.{MESSAGE_TOOL_CALL_ID}") == "toolu_test_1"
    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.3.{MESSAGE_CONTENT}") == "sunny, 20C"

    assert attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "assistant"
    assert attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}") == response_text

    assert isinstance(prompt_tokens := attributes.pop(LLM_TOKEN_COUNT_PROMPT), int)
    assert isinstance(completion_tokens := attributes.pop(LLM_TOKEN_COUNT_COMPLETION), int)
    assert attributes.pop(LLM_TOKEN_COUNT_TOTAL) == prompt_tokens + completion_tokens

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    parsed_input = json.loads(input_value)
    assert set(parsed_input) == {"messages", "model_settings", "model_request_parameters"}
    assert len(parsed_input["messages"]) == 3
    assert parsed_input["model_settings"] == dict(settings)
    parsed_params = parsed_input["model_request_parameters"]
    assert len(parsed_params["function_tools"]) == 1
    assert parsed_params["function_tools"][0]["name"] == "get_weather"
    assert attributes.pop(INPUT_MIME_TYPE) == JSON

    output_value = attributes.pop(OUTPUT_VALUE)
    assert isinstance(output_value, str)
    parsed_output = json.loads(output_value)
    assert parsed_output["kind"] == "response"
    output_parts = parsed_output["parts"]
    assert len(output_parts) == 1
    assert output_parts[0]["part_kind"] == "text"
    assert output_parts[0]["content"] == response_text
    assert parsed_output["usage"]["input_tokens"] == prompt_tokens
    assert parsed_output["usage"]["output_tokens"] == completion_tokens
    assert attributes.pop(OUTPUT_MIME_TYPE) == JSON

    assert not attributes


async def test_request_raises_expected_exception_events(
    raising_model: OpenInferenceModelWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    with pytest.raises(RuntimeError, match="boom from raising model"):
        await raising_model.request(
            messages=[ModelRequest(parts=[UserPromptPart(content="anything")])],
            model_settings=None,
            model_request_parameters=ModelRequestParameters(
                function_tools=[], builtin_tools=[], output_tools=[]
            ),
        )

    spans = in_memory_span_exporter.get_finished_spans()
    assert len(spans) == 1
    span = spans[0]
    assert span.name == "test"
    assert span.status.status_code == StatusCode.ERROR
    assert span.status.description == "RuntimeError: boom from raising model"

    assert len(span.events) == 1
    (exception_event,) = span.events
    assert exception_event.name == "exception"
    exception_attributes = dict(exception_event.attributes or {})
    assert exception_attributes.pop("exception.type") == "RuntimeError"
    assert exception_attributes.pop("exception.message") == "boom from raising model"
    assert isinstance(exception_attributes.pop("exception.stacktrace"), str)
    assert exception_attributes.pop("exception.escaped") == "False"
    assert not exception_attributes

    attributes = dict(span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
    assert attributes.pop(LLM_PROVIDER) == "test"
    assert attributes.pop(LLM_SYSTEM) == "test"
    assert attributes.pop(LLM_MODEL_NAME) == "test"
    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "user"
    assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}") == "anything"

    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    parsed_input = json.loads(input_value)
    assert set(parsed_input) == {"messages", "model_settings", "model_request_parameters"}
    assert parsed_input["model_settings"] is None
    parsed_messages = parsed_input["messages"]
    assert len(parsed_messages) == 1
    parsed_request = parsed_messages[0]
    assert parsed_request["kind"] == "request"
    parsed_parts = parsed_request["parts"]
    assert len(parsed_parts) == 1
    assert parsed_parts[0]["part_kind"] == "user-prompt"
    assert parsed_parts[0]["content"] == "anything"
    assert attributes.pop(INPUT_MIME_TYPE) == JSON

    assert OUTPUT_VALUE not in attributes
    assert OUTPUT_MIME_TYPE not in attributes
    assert not attributes


# OpenInference attribute keys
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
LLM_PROVIDER = SpanAttributes.LLM_PROVIDER
LLM_SYSTEM = SpanAttributes.LLM_SYSTEM
LLM_MODEL_NAME = SpanAttributes.LLM_MODEL_NAME
LLM_INVOCATION_PARAMETERS = SpanAttributes.LLM_INVOCATION_PARAMETERS
LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
LLM_TOKEN_COUNT_TOTAL = SpanAttributes.LLM_TOKEN_COUNT_TOTAL
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
LLM_TOOLS = SpanAttributes.LLM_TOOLS
TOOL_JSON_SCHEMA = ToolAttributes.TOOL_JSON_SCHEMA
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE
MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS
MESSAGE_TOOL_CALL_ID = MessageAttributes.MESSAGE_TOOL_CALL_ID
TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID
TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
TOOL_CALL_FUNCTION_ARGUMENTS_JSON = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON
INPUT_VALUE = SpanAttributes.INPUT_VALUE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE

LLM = OpenInferenceSpanKindValues.LLM.value
PROVIDER_ANTHROPIC = OpenInferenceLLMProviderValues.ANTHROPIC.value
SYSTEM_ANTHROPIC = OpenInferenceLLMSystemValues.ANTHROPIC.value
JSON = OpenInferenceMimeTypeValues.JSON.value
TEXT = OpenInferenceMimeTypeValues.TEXT.value

MODEL_NAME = "claude-haiku-4-5"
