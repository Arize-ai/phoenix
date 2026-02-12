import json
from contextlib import asynccontextmanager
from typing import Any

import pytest
from openai import AsyncOpenAI, AuthenticationError
from openinference.semconv.trace import (
    MessageAttributes,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolAttributes,
    ToolCallAttributes,
)
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode, Tracer

from phoenix.server.api.helpers.message_helpers import PlaygroundMessage, create_playground_message
from phoenix.server.api.helpers.playground_clients import (
    OpenAIBaseStreamingClient,
)
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import TextChunk
from tests.unit.vcr import CustomVCR


class TestOpenAIBaseStreamingClient:
    @pytest.fixture
    def in_memory_span_exporter(self) -> InMemorySpanExporter:
        return InMemorySpanExporter()

    @pytest.fixture
    def tracer(self, in_memory_span_exporter: InMemorySpanExporter) -> Tracer:
        provider = TracerProvider()
        provider.add_span_processor(SimpleSpanProcessor(in_memory_span_exporter))
        return provider.get_tracer(__name__)

    @pytest.fixture
    def openai_client_factory(
        self,
        openai_api_key: str,
    ) -> Any:
        @asynccontextmanager
        async def factory() -> Any:
            yield AsyncOpenAI()

        return factory

    async def test_text_response_records_expected_attributes(
        self,
        openai_client_factory: Any,
        custom_vcr: CustomVCR,
        tracer: Tracer,
        in_memory_span_exporter: InMemorySpanExporter,
    ) -> None:
        client = OpenAIBaseStreamingClient(
            client_factory=openai_client_factory,
            model_name="gpt-4o-mini",
            provider="openai",
        )

        messages: list[PlaygroundMessage] = [
            create_playground_message(
                ChatCompletionMessageRole.USER,
                "Who won the World Cup in 2018? Answer in one word",
            )
        ]

        invocation_parameters = {"temperature": 0.1}

        with custom_vcr.use_cassette():
            text_chunks = []
            async for chunk in client.chat_completion_create(
                messages=messages,
                tools=[],
                tracer=tracer,
                **invocation_parameters,
            ):
                if isinstance(chunk, TextChunk):
                    text_chunks.append(chunk.content)

        spans = in_memory_span_exporter.get_finished_spans()
        assert len(spans) == 1
        span: ReadableSpan = spans[0]

        assert span.name == "ChatCompletion"
        assert span.status.is_ok
        assert not span.events

        assert span.attributes is not None
        attributes = dict(span.attributes)

        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
        assert attributes.pop(LLM_MODEL_NAME) == "gpt-4o-mini"

        invocation_params = attributes.pop(LLM_INVOCATION_PARAMETERS)
        assert isinstance(invocation_params, str)
        assert json.loads(invocation_params) == {"temperature": 0.1}

        input_messages_role = attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}")
        assert input_messages_role == "user"
        input_messages_content = attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}")
        assert input_messages_content == "Who won the World Cup in 2018? Answer in one word"

        output_messages_role = attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}")
        assert output_messages_role == "assistant"
        output_messages_content = attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}")
        response_text = "".join(text_chunks)
        assert output_messages_content == response_text
        assert "france" in response_text.lower()

        token_count_total = attributes.pop(LLM_TOKEN_COUNT_TOTAL)
        assert isinstance(token_count_total, int)
        assert token_count_total > 0

        token_count_prompt = attributes.pop(LLM_TOKEN_COUNT_PROMPT)
        assert isinstance(token_count_prompt, int)
        assert token_count_prompt > 0

        token_count_completion = attributes.pop(LLM_TOKEN_COUNT_COMPLETION)
        assert isinstance(token_count_completion, int)
        assert token_count_completion > 0

        assert token_count_total == token_count_prompt + token_count_completion

        cache_read = attributes.pop(LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ)
        assert cache_read == 0

        reasoning_tokens = attributes.pop(LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING)
        assert reasoning_tokens == 0

        audio_prompt_tokens = attributes.pop("llm.token_count.prompt_details.audio")
        assert audio_prompt_tokens == 0

        audio_completion_tokens = attributes.pop("llm.token_count.completion_details.audio")
        assert audio_completion_tokens == 0

        url_full = attributes.pop("url.full")
        assert url_full == "https://api.openai.com/v1/chat/completions"

        url_path = attributes.pop("url.path")
        assert url_path == "chat/completions"

        llm_provider = attributes.pop(LLM_PROVIDER)
        assert llm_provider == "openai"

        llm_system = attributes.pop(LLM_SYSTEM)
        assert llm_system == "openai"

        assert attributes.pop(INPUT_VALUE)
        assert attributes.pop(INPUT_MIME_TYPE) == JSON
        assert attributes.pop(OUTPUT_VALUE)
        assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT

        assert not attributes

    async def test_tool_call_response_records_expected_attributes(
        self,
        openai_client_factory: Any,
        custom_vcr: CustomVCR,
        tracer: Tracer,
        in_memory_span_exporter: InMemorySpanExporter,
    ) -> None:
        client = OpenAIBaseStreamingClient(
            client_factory=openai_client_factory,
            model_name="gpt-4o-mini",
            provider="openai",
        )

        get_current_weather_tool_schema = {
            "type": "function",
            "function": {
                "name": "get_current_weather",
                "description": "Get the current weather in a given location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city name, e.g. San Francisco",
                        },
                    },
                    "required": ["location"],
                },
            },
        }

        messages: list[PlaygroundMessage] = [
            create_playground_message(
                ChatCompletionMessageRole.USER,
                "How's the weather in San Francisco?",
            )
        ]

        invocation_parameters = {"tool_choice": "auto"}

        with custom_vcr.use_cassette():
            tool_call_chunks = []
            async for chunk in client.chat_completion_create(
                messages=messages,
                tools=[get_current_weather_tool_schema],
                tracer=tracer,
                **invocation_parameters,
            ):
                tool_call_chunks.append(chunk)

        spans = in_memory_span_exporter.get_finished_spans()
        assert len(spans) == 1
        span: ReadableSpan = spans[0]

        assert span.name == "ChatCompletion"
        assert span.status.is_ok
        assert not span.events

        assert span.attributes is not None
        attributes = dict(span.attributes)

        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
        assert attributes.pop(LLM_MODEL_NAME) == "gpt-4o-mini"

        invocation_params = attributes.pop(LLM_INVOCATION_PARAMETERS)
        assert isinstance(invocation_params, str)
        assert json.loads(invocation_params) == {"tool_choice": "auto"}

        input_messages_role = attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}")
        assert input_messages_role == "user"
        input_messages_content = attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}")
        assert input_messages_content == "How's the weather in San Francisco?"

        output_messages_role = attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}")
        assert output_messages_role == "assistant"

        tool_call_id = attributes.pop(
            f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_ID}"
        )
        assert isinstance(tool_call_id, str)

        tool_call_function_name = attributes.pop(
            f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_NAME}"
        )
        assert tool_call_function_name == "get_current_weather"

        tool_call_function_arguments = attributes.pop(
            f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}"
        )
        assert isinstance(tool_call_function_arguments, str)
        arguments = json.loads(tool_call_function_arguments)
        assert arguments == {"location": "San Francisco"}

        token_count_total = attributes.pop(LLM_TOKEN_COUNT_TOTAL)
        assert isinstance(token_count_total, int)
        assert token_count_total > 0

        token_count_prompt = attributes.pop(LLM_TOKEN_COUNT_PROMPT)
        assert isinstance(token_count_prompt, int)
        assert token_count_prompt > 0

        token_count_completion = attributes.pop(LLM_TOKEN_COUNT_COMPLETION)
        assert isinstance(token_count_completion, int)
        assert token_count_completion > 0

        assert token_count_total == token_count_prompt + token_count_completion

        cache_read = attributes.pop(LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ)
        assert cache_read == 0

        reasoning_tokens = attributes.pop(LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING)
        assert reasoning_tokens == 0

        audio_prompt_tokens = attributes.pop("llm.token_count.prompt_details.audio")
        assert audio_prompt_tokens == 0

        audio_completion_tokens = attributes.pop("llm.token_count.completion_details.audio")
        assert audio_completion_tokens == 0

        url_full = attributes.pop("url.full")
        assert url_full == "https://api.openai.com/v1/chat/completions"

        url_path = attributes.pop("url.path")
        assert url_path == "chat/completions"

        llm_provider = attributes.pop(LLM_PROVIDER)
        assert llm_provider == "openai"

        llm_system = attributes.pop(LLM_SYSTEM)
        assert llm_system == "openai"

        llm_tool_schema = attributes.pop(f"{LLM_TOOLS}.0.{TOOL_JSON_SCHEMA}")
        assert llm_tool_schema == json.dumps(get_current_weather_tool_schema)

        assert attributes.pop(INPUT_VALUE)
        assert attributes.pop(INPUT_MIME_TYPE) == JSON
        assert attributes.pop(OUTPUT_VALUE)
        assert attributes.pop(OUTPUT_MIME_TYPE) == JSON

        assert not attributes

    async def test_authentication_error_records_error_status_on_span(
        self,
        openai_client_factory: Any,
        custom_vcr: CustomVCR,
        tracer: Tracer,
        in_memory_span_exporter: InMemorySpanExporter,
    ) -> None:
        client = OpenAIBaseStreamingClient(
            client_factory=openai_client_factory,
            model_name="gpt-4o-mini",
            provider="openai",
        )

        messages: list[PlaygroundMessage] = [
            create_playground_message(
                ChatCompletionMessageRole.USER,
                "Say hello",
            )
        ]

        invocation_parameters = {"temperature": 0.1}

        with custom_vcr.use_cassette():
            with pytest.raises(AuthenticationError) as exc_info:
                async for _ in client.chat_completion_create(
                    messages=messages,
                    tools=[],
                    tracer=tracer,
                    **invocation_parameters,
                ):
                    pass

        assert exc_info.value.status_code == 401

        spans = in_memory_span_exporter.get_finished_spans()
        assert len(spans) == 1
        span = spans[0]

        assert span.name == "ChatCompletion"
        assert span.status.status_code is StatusCode.ERROR
        status_description = span.status.description
        assert status_description is not None
        assert isinstance(status_description, str)
        assert status_description.startswith("Error code: 401")
        assert "invalid_api_key" in status_description

        events = span.events
        assert len(events) == 1
        event = events[0]
        assert event.name == "exception"
        assert event.attributes is not None
        event_attrs = dict(event.attributes)
        assert event_attrs.pop("exception.type") == "openai.AuthenticationError"
        exception_message = event_attrs.pop("exception.message")
        assert isinstance(exception_message, str)
        assert exception_message.startswith("Error code: 401")
        assert event_attrs.pop("exception.escaped") == "False"
        exception_stacktrace = event_attrs.pop("exception.stacktrace")
        assert isinstance(exception_stacktrace, str)
        assert "AuthenticationError" in exception_stacktrace
        assert not event_attrs

        assert span.attributes is not None
        attributes = dict(span.attributes)

        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
        assert attributes.pop(LLM_MODEL_NAME) == "gpt-4o-mini"

        invocation_params = attributes.pop(LLM_INVOCATION_PARAMETERS)
        assert isinstance(invocation_params, str)
        assert json.loads(invocation_params) == {"temperature": 0.1}

        assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "user"
        assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}") == "Say hello"

        assert attributes.pop(LLM_PROVIDER) == "openai"
        assert attributes.pop(LLM_SYSTEM) == "openai"

        url_full = attributes.pop("url.full")
        assert url_full == "https://api.openai.com/v1/chat/completions"

        url_path = attributes.pop("url.path")
        assert url_path == "chat/completions"

        input_value = attributes.pop(INPUT_VALUE)
        assert isinstance(input_value, str)
        input_data = json.loads(input_value)
        assert input_data == {
            "messages": [{"role": "USER", "content": "Say hello"}],
            "tools": [],
            "invocation_parameters": {"temperature": 0.1},
        }
        assert attributes.pop(INPUT_MIME_TYPE) == JSON

        assert not attributes


# mime types
JSON = OpenInferenceMimeTypeValues.JSON.value
TEXT = OpenInferenceMimeTypeValues.TEXT.value
LLM = OpenInferenceSpanKindValues.LLM.value

# span attributes
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
LLM_MODEL_NAME = SpanAttributes.LLM_MODEL_NAME
LLM_INVOCATION_PARAMETERS = SpanAttributes.LLM_INVOCATION_PARAMETERS
LLM_TOKEN_COUNT_TOTAL = SpanAttributes.LLM_TOKEN_COUNT_TOTAL
LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ = SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ
LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING = (
    SpanAttributes.LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING
)
LLM_PROVIDER = SpanAttributes.LLM_PROVIDER
LLM_SYSTEM = SpanAttributes.LLM_SYSTEM
LLM_TOOLS = SpanAttributes.LLM_TOOLS

# message attributes
MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE
MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS

# tool call attributes
TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID
TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
TOOL_CALL_FUNCTION_ARGUMENTS_JSON = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON

# tool attributes
TOOL_JSON_SCHEMA = ToolAttributes.TOOL_JSON_SCHEMA
