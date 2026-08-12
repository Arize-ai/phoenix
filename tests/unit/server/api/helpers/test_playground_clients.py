import json
from collections.abc import AsyncIterator
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
from opentelemetry.trace import INVALID_SPAN, StatusCode, Tracer
from pydantic import SecretStr

from phoenix.db import models
from phoenix.db.types.experiment_config import OpenAIConnectionConfig
from phoenix.db.types.model_provider import LLMClientFactory, ModelProvider
from phoenix.db.types.prompts import (
    PromptAnthropicInvocationParameters,
    PromptAnthropicInvocationParametersContent,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptToolChoiceSpecificFunctionTool,
    PromptToolChoiceZeroOrMore,
    PromptToolFunction,
    PromptToolFunctionDefinition,
    PromptToolRaw,
    PromptTools,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.message_helpers import PlaygroundMessage, create_playground_message
from phoenix.server.api.helpers.playground_clients import (
    OPENAI_CHAT_COMPLETIONS_MODELS,
    OPENAI_REASONING_MODELS,
    AnthropicStreamingClient,
    AzureOpenAIResponsesAPIStreamingClient,
    AzureOpenAIStreamingClient,
    GoogleStreamingClient,
    OpenAIBaseStreamingClient,
    OpenAIResponsesAPIStreamingClient,
    OpenAIStreamingClient,
    _get_builtin_provider_client,
    _get_custom_provider_client,
    _resolve_provider_api_key,
    get_openai_client_class,
)
from phoenix.server.api.helpers.playground_registry import (
    PLAYGROUND_CLIENT_REGISTRY,
    PROVIDER_DEFAULT,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.input_types.ModelClientOptionsInput import OpenAIApiType
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import TextChunk
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.types import DbSessionFactory
from tests.unit.vcr import CustomVCR


class TestGoogleStreamingClient:
    @pytest.fixture
    def client(self) -> GoogleStreamingClient:
        return object.__new__(GoogleStreamingClient)

    def test_rate_limit_error(self, client: GoogleStreamingClient) -> None:
        from google.genai.errors import ClientError

        assert client.is_rate_limit_error(ClientError(429, {}))
        assert not client.is_rate_limit_error(ClientError(400, {}))

    def test_transient_error(self, client: GoogleStreamingClient) -> None:
        from google.genai.errors import ClientError, ServerError

        assert client.is_transient_error(ServerError(500, {}))
        assert not client.is_transient_error(ClientError(400, {}))
        assert client.is_transient_error(TimeoutError())


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
        async def factory() -> AsyncIterator[Any]:
            yield AsyncOpenAI(max_retries=0)

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

        invocation_parameters = PromptOpenAIInvocationParameters(
            type="openai",
            openai=PromptOpenAIInvocationParametersContent(temperature=0.1),
        )

        with custom_vcr.use_cassette():
            text_chunks = []
            async for chunk in client.chat_completion_create(
                messages=messages,
                tools=None,
                invocation_parameters=invocation_parameters,
                tracer=tracer,
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
        assert json.loads(invocation_params) == {
            "temperature": 0.1,
        }

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

        get_current_weather_tools = PromptTools(
            type="tools",
            tool_choice=PromptToolChoiceZeroOrMore(type="zero_or_more"),
            tools=[
                PromptToolFunction(
                    type="function",
                    function=PromptToolFunctionDefinition(
                        name="get_current_weather",
                        description="Get the current weather in a given location",
                        parameters={
                            "type": "object",
                            "properties": {
                                "location": {
                                    "type": "string",
                                    "description": "The city name, e.g. San Francisco",
                                },
                            },
                            "required": ["location"],
                        },
                    ),
                )
            ],
        )

        messages: list[PlaygroundMessage] = [
            create_playground_message(
                ChatCompletionMessageRole.USER,
                "How's the weather in San Francisco?",
            )
        ]

        invocation_parameters = PromptOpenAIInvocationParameters(
            type="openai",
            openai=PromptOpenAIInvocationParametersContent(),
        )

        with custom_vcr.use_cassette():
            tool_call_chunks = []
            async for chunk in client.chat_completion_create(
                messages=messages,
                tools=get_current_weather_tools,
                tracer=tracer,
                invocation_parameters=invocation_parameters,
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
        assert json.loads(invocation_params) == {
            "tool_choice": "auto",
        }

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

        assert isinstance(
            llm_tool_schema := attributes.pop(f"{LLM_TOOLS}.0.{TOOL_JSON_SCHEMA}"), str
        )
        assert json.loads(llm_tool_schema) == {
            "type": "function",
            "function": {
                "name": "get_current_weather",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city name, e.g. San Francisco",
                        }
                    },
                    "required": ["location"],
                },
                "strict": None,
                "description": "Get the current weather in a given location",
            },
        }

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

        invocation_parameters = PromptOpenAIInvocationParameters(
            type="openai",
            openai=PromptOpenAIInvocationParametersContent(temperature=0.1),
        )

        with custom_vcr.use_cassette():
            with pytest.raises(AuthenticationError) as exc_info:
                async for _ in client.chat_completion_create(
                    messages=messages,
                    tools=None,
                    tracer=tracer,
                    invocation_parameters=invocation_parameters,
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
        assert json.loads(invocation_params) == {
            "temperature": 0.1,
        }

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
            "messages": [{"role": "user", "content": "Say hello"}],
            "model": "gpt-4o-mini",
            "temperature": 0.1,
        }
        assert attributes.pop(INPUT_MIME_TYPE) == JSON

        assert not attributes


class TestAnthropicStreamingClient:
    def test_specific_tool_choice_includes_tool_definitions(self) -> None:
        @asynccontextmanager
        async def create_client() -> AsyncIterator[Any]:
            yield None

        client: Any = AnthropicStreamingClient(
            client_factory=LLMClientFactory(create_client, ("anthropic", "test")),
            model_name="claude-3-5-sonnet-latest",
            provider="anthropic",
        )
        tools = PromptTools(
            type="tools",
            tool_choice=PromptToolChoiceSpecificFunctionTool(
                type="specific_function",
                function_name="correctness",
            ),
            tools=[
                PromptToolFunction(
                    type="function",
                    function=PromptToolFunctionDefinition(
                        name="correctness",
                        description="Evaluate correctness",
                        parameters={
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "explanation": {"type": "string"},
                            },
                            "required": ["label", "explanation"],
                        },
                    ),
                )
            ],
        )

        params, _, extra_headers = client._anthropic_message_params(
            messages=[
                create_playground_message(
                    ChatCompletionMessageRole.USER,
                    "Evaluate this answer.",
                )
            ],
            tools=tools,
            response_format=None,
            invocation_parameters=PromptAnthropicInvocationParameters(
                type="anthropic",
                anthropic=PromptAnthropicInvocationParametersContent(
                    max_tokens=1024,
                ),
            ),
        )

        assert params["tool_choice"] == {"type": "tool", "name": "correctness"}
        assert params["tools"] == [
            {
                "name": "correctness",
                "description": "Evaluate correctness",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string"},
                        "explanation": {"type": "string"},
                    },
                    "required": ["label", "explanation"],
                },
            }
        ]
        assert extra_headers is None

    def test_raw_computer_tools_add_anthropic_beta_header(self) -> None:
        @asynccontextmanager
        async def create_client() -> AsyncIterator[Any]:
            yield None

        client: Any = AnthropicStreamingClient(
            client_factory=LLMClientFactory(create_client, ("anthropic", "test")),
            model_name="claude-3-5-sonnet-latest",
            provider="anthropic",
        )
        tools = PromptTools(
            type="tools",
            tools=[
                PromptToolRaw(
                    type="raw",
                    raw={
                        "type": "computer_20250124",
                        "name": "computer",
                        "display_width_px": 1280,
                        "display_height_px": 800,
                    },
                ),
                PromptToolRaw(
                    type="raw",
                    raw={
                        "type": "computer_20251124",
                        "name": "computer",
                        "display_width_px": 1280,
                        "display_height_px": 800,
                    },
                ),
            ],
        )

        params, _, extra_headers = client._anthropic_message_params(
            messages=[
                create_playground_message(
                    ChatCompletionMessageRole.USER,
                    "Open the browser.",
                )
            ],
            tools=tools,
            response_format=None,
            invocation_parameters=PromptAnthropicInvocationParameters(
                type="anthropic",
                anthropic=PromptAnthropicInvocationParametersContent(
                    max_tokens=1024,
                ),
            ),
        )

        assert params["tools"] == [tool.raw for tool in tools.tools if tool.type == "raw"]
        assert extra_headers == {
            "anthropic-beta": "computer-use-2025-01-24,computer-use-2025-11-24"
        }


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


class TestGetOpenAIClientClass:
    """Tests for the get_openai_client_class helper function."""

    # OpenAI provider tests

    def test_openai_chat_completions_returns_streaming_client(self) -> None:
        """Standard models with CHAT_COMPLETIONS should return OpenAIStreamingClient."""
        client_class = get_openai_client_class(
            GenerativeProviderKey.OPENAI,
            "gpt-4o",
            OpenAIApiType.CHAT_COMPLETIONS,
        )
        assert client_class is OpenAIStreamingClient

    def test_openai_chat_completions_custom_model_returns_streaming_client(self) -> None:
        """Custom/unknown models with CHAT_COMPLETIONS should return OpenAIStreamingClient."""
        client_class = get_openai_client_class(
            GenerativeProviderKey.OPENAI,
            "my-custom-fine-tuned-model",
            OpenAIApiType.CHAT_COMPLETIONS,
        )
        assert client_class is OpenAIStreamingClient

    def test_openai_chat_completions_reasoning_model_returns_streaming_client(self) -> None:
        """Reasoning models need no Chat Completions specialization -- they accept
        `system` and every other parameter the base client sends."""
        for model_name in ["o1", "o3", "o3-mini", "gpt-5.6-luna"]:
            client_class = get_openai_client_class(
                GenerativeProviderKey.OPENAI,
                model_name,
                OpenAIApiType.CHAT_COMPLETIONS,
            )
            assert client_class is OpenAIStreamingClient, f"Failed for {model_name}"

    def test_openai_responses_returns_responses_client(self) -> None:
        """RESPONSES API type should return OpenAIResponsesAPIStreamingClient."""
        client_class = get_openai_client_class(
            GenerativeProviderKey.OPENAI,
            "gpt-4o",
            OpenAIApiType.RESPONSES,
        )
        assert client_class is OpenAIResponsesAPIStreamingClient

    def test_openai_responses_custom_model_returns_responses_client(self) -> None:
        """Custom models with RESPONSES should return OpenAIResponsesAPIStreamingClient."""
        client_class = get_openai_client_class(
            GenerativeProviderKey.OPENAI,
            "my-custom-model",
            OpenAIApiType.RESPONSES,
        )
        assert client_class is OpenAIResponsesAPIStreamingClient

    def test_openai_none_api_type_uses_registry_fallback(self) -> None:
        """When openai_api_type is None, should fall back to registry."""
        # For known models, registry should return the registered client
        client_class = get_openai_client_class(
            GenerativeProviderKey.OPENAI,
            "gpt-4o",
            None,
        )
        assert client_class is OpenAIStreamingClient

        # For unknown models, registry should return PROVIDER_DEFAULT
        client_class = get_openai_client_class(
            GenerativeProviderKey.OPENAI,
            "unknown-model",
            None,
        )
        # PROVIDER_DEFAULT for OpenAI is OpenAIResponsesAPIStreamingClient
        assert client_class is OpenAIResponsesAPIStreamingClient

    # Azure OpenAI provider tests

    def test_azure_chat_completions_returns_azure_streaming_client(self) -> None:
        """Azure with CHAT_COMPLETIONS should return AzureOpenAIStreamingClient."""
        client_class = get_openai_client_class(
            GenerativeProviderKey.AZURE_OPENAI,
            "gpt-4o",
            OpenAIApiType.CHAT_COMPLETIONS,
        )
        assert client_class is AzureOpenAIStreamingClient

    def test_azure_chat_completions_custom_model_returns_azure_streaming_client(self) -> None:
        """Azure custom models with CHAT_COMPLETIONS should return AzureOpenAIStreamingClient."""
        client_class = get_openai_client_class(
            GenerativeProviderKey.AZURE_OPENAI,
            "my-azure-deployment",
            OpenAIApiType.CHAT_COMPLETIONS,
        )
        assert client_class is AzureOpenAIStreamingClient

    def test_azure_chat_completions_reasoning_model_returns_streaming_client(self) -> None:
        """Azure reasoning models need no Chat Completions specialization either."""
        for model_name in ["o1", "gpt-5.6-luna"]:
            client_class = get_openai_client_class(
                GenerativeProviderKey.AZURE_OPENAI,
                model_name,
                OpenAIApiType.CHAT_COMPLETIONS,
            )
            assert client_class is AzureOpenAIStreamingClient, f"Failed for {model_name}"

    def test_azure_responses_returns_azure_responses_client(self) -> None:
        """Azure with RESPONSES should return AzureOpenAIResponsesAPIStreamingClient."""
        client_class = get_openai_client_class(
            GenerativeProviderKey.AZURE_OPENAI,
            "gpt-4o",
            OpenAIApiType.RESPONSES,
        )
        assert client_class is AzureOpenAIResponsesAPIStreamingClient

    # Non-OpenAI provider tests

    def test_anthropic_returns_none(self) -> None:
        """Non-OpenAI providers should return None (caller uses registry)."""
        client_class = get_openai_client_class(
            GenerativeProviderKey.ANTHROPIC,
            "claude-3-opus",
            OpenAIApiType.CHAT_COMPLETIONS,
        )
        assert client_class is None

    def test_google_returns_none(self) -> None:
        """Google provider should return None."""
        client_class = get_openai_client_class(
            GenerativeProviderKey.GOOGLE,
            "gemini-pro",
            OpenAIApiType.CHAT_COMPLETIONS,
        )
        assert client_class is None

    def test_aws_returns_none(self) -> None:
        """AWS Bedrock provider should return None."""
        client_class = get_openai_client_class(
            GenerativeProviderKey.AWS,
            "anthropic.claude-v2",
            None,
        )
        assert client_class is None


class TestReasoningModelClientRouting:
    """Reasoning models must reach the Responses API when no API type is configured.

    They reject function tools combined with ``reasoning_effort`` on
    ``/v1/chat/completions``, and LLM evaluators always send a function tool.
    """

    @pytest.mark.parametrize(
        "provider_key,expected_class",
        [
            (GenerativeProviderKey.OPENAI, OpenAIResponsesAPIStreamingClient),
            (GenerativeProviderKey.AZURE_OPENAI, AzureOpenAIResponsesAPIStreamingClient),
        ],
    )
    def test_reasoning_models_default_to_responses_client(
        self,
        provider_key: GenerativeProviderKey,
        expected_class: type[OpenAIBaseStreamingClient],
    ) -> None:
        for model_name in OPENAI_REASONING_MODELS:
            client_class = get_openai_client_class(provider_key, model_name, None)
            assert client_class is expected_class, f"Failed for {model_name}"

    def test_response_params_keep_tools_and_map_reasoning_effort(self) -> None:
        """Function tools + reasoning_effort + disabled parallel tool calls must all
        survive translation into a Responses API request."""
        client = OpenAIResponsesAPIStreamingClient(
            client_factory=LLMClientFactory(
                lambda: AsyncOpenAI(api_key="sk-test"), ("openai", "test")
            ),
            model_name="gpt-5.6-luna",
            provider="openai",
        )

        tools = PromptTools(
            type="tools",
            tools=[
                PromptToolFunction(
                    type="function",
                    function=PromptToolFunctionDefinition(
                        name="record_evaluation",
                        description="Record the evaluation result",
                        parameters={
                            "type": "object",
                            "properties": {"label": {"type": "string"}},
                        },
                    ),
                )
            ],
            tool_choice=PromptToolChoiceSpecificFunctionTool(
                type="specific_function", function_name="record_evaluation"
            ),
            disable_parallel_tool_calls=True,
        )
        invocation_parameters = PromptOpenAIInvocationParameters(
            type="openai",
            openai=PromptOpenAIInvocationParametersContent(reasoning_effort="high"),
        )
        messages: list[PlaygroundMessage] = [
            create_playground_message(ChatCompletionMessageRole.USER, "Evaluate this span.")
        ]

        params, extra_body = client._openai_response_build_params(
            messages=messages,
            tools=tools,
            response_format=None,
            invocation_parameters=invocation_parameters,
            span=INVALID_SPAN,
        )

        assert extra_body is None
        assert params["model"] == "gpt-5.6-luna"
        assert params["parallel_tool_calls"] is False
        tool_params = params.get("tools")
        assert tool_params, "function tools were dropped from the Responses request"
        assert tool_params[0]["name"] == "record_evaluation"
        assert params["tool_choice"] == {"type": "function", "name": "record_evaluation"}
        assert params["reasoning"] == {"effort": "high"}
        assert "reasoning_effort" not in params


class TestDefaultApiTypeRouting:
    """``get_openai_client_class`` decides the client when no API type is configured.

    The playground registry carries the model catalog, not routing.
    """

    @pytest.mark.parametrize(
        "model_provider,model_name,expected_class",
        [
            # The exact configuration that produced the 400 in #15299: builtin
            # provider, no connection config, reasoning model, function tool.
            (ModelProvider.OPENAI, "gpt-5.6-luna", OpenAIResponsesAPIStreamingClient),
            (ModelProvider.OPENAI, "o3", OpenAIResponsesAPIStreamingClient),
            (ModelProvider.OPENAI, "gpt-4o", OpenAIStreamingClient),
            (ModelProvider.OPENAI, "gpt-6-does-not-exist-yet", OpenAIResponsesAPIStreamingClient),
        ],
    )
    async def test_builtin_client_without_connection_config(
        self,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
        model_provider: ModelProvider,
        model_name: str,
        expected_class: type[OpenAIBaseStreamingClient],
    ) -> None:
        """End-to-end through the path evaluators take: connection=None.

        The registry is poisoned for this model so the assertion fails if any part of
        the builtin path starts consulting it again.
        """
        monkeypatch.setenv("OPENAI_API_KEY", "sk-from-env")

        class WrongClient(OpenAIStreamingClient):
            pass

        provider_key = GenerativeProviderKey.from_model_provider(model_provider)
        poisoned = dict(PLAYGROUND_CLIENT_REGISTRY._registry[provider_key])
        poisoned[model_name] = WrongClient
        poisoned[PROVIDER_DEFAULT] = WrongClient
        monkeypatch.setitem(PLAYGROUND_CLIENT_REGISTRY._registry, provider_key, poisoned)

        async with db() as session:
            client = await _get_builtin_provider_client(
                model_provider,
                model_name,
                None,
                None,
                session,
                _identity_decrypt,
            )
        assert type(client) is expected_class

    def test_legacy_model_list_is_exactly_the_pre_responses_models(self) -> None:
        """Literal expectation: a name silently added or dropped changes routing."""
        assert set(OPENAI_CHAT_COMPLETIONS_MODELS) == {
            "gpt-4.1",
            "gpt-4.1-mini",
            "gpt-4.1-nano",
            "gpt-4o",
            "chatgpt-4o-latest",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-4-turbo-preview",
            "gpt-4",
            "gpt-3.5-turbo",
        }
        assert not set(OPENAI_CHAT_COMPLETIONS_MODELS) & set(OPENAI_REASONING_MODELS)

    def test_openai_defaults_to_responses_except_legacy_models(self) -> None:
        for model_name in OPENAI_CHAT_COMPLETIONS_MODELS:
            assert (
                get_openai_client_class(GenerativeProviderKey.OPENAI, model_name, None)
                is OpenAIStreamingClient
            ), f"Failed for {model_name}"
        for model_name in [*OPENAI_REASONING_MODELS, "gpt-6-does-not-exist-yet"]:
            assert (
                get_openai_client_class(GenerativeProviderKey.OPENAI, model_name, None)
                is OpenAIResponsesAPIStreamingClient
            ), f"Failed for {model_name}"

    def test_azure_defaults_to_chat_completions_except_reasoning_models(self) -> None:
        for model_name in OPENAI_REASONING_MODELS:
            assert (
                get_openai_client_class(GenerativeProviderKey.AZURE_OPENAI, model_name, None)
                is AzureOpenAIResponsesAPIStreamingClient
            ), f"Failed for {model_name}"
        for model_name in ["gpt-4o"]:
            assert (
                get_openai_client_class(GenerativeProviderKey.AZURE_OPENAI, model_name, None)
                is AzureOpenAIStreamingClient
            ), f"Failed for {model_name}"

    def test_azure_deployment_alias_is_not_recognized_as_a_reasoning_model(self) -> None:
        """Known limitation, not desired behavior.

        Azure model names are user-chosen deployment names, so a reasoning model
        deployed under an alias is indistinguishable from any other deployment and
        falls to Chat Completions -- where function tools plus reasoning_effort still
        fail. Closing this needs deployment metadata from Azure, not name matching.
        """
        assert (
            get_openai_client_class(GenerativeProviderKey.AZURE_OPENAI, "prod-evaluator", None)
            is AzureOpenAIStreamingClient
        )

    @pytest.mark.parametrize(
        "provider_key,model_name,expected_class",
        [
            (GenerativeProviderKey.OPENAI, "gpt-5.6-luna", OpenAIResponsesAPIStreamingClient),
            (GenerativeProviderKey.OPENAI, "gpt-4o", OpenAIStreamingClient),
            (
                GenerativeProviderKey.AZURE_OPENAI,
                "gpt-5.6-luna",
                AzureOpenAIResponsesAPIStreamingClient,
            ),
            (GenerativeProviderKey.AZURE_OPENAI, "gpt-4o", AzureOpenAIStreamingClient),
        ],
    )
    def test_registry_entries_do_not_affect_routing(
        self,
        monkeypatch: pytest.MonkeyPatch,
        provider_key: GenerativeProviderKey,
        model_name: str,
        expected_class: type[OpenAIBaseStreamingClient],
    ) -> None:
        """A wrong catalog entry must not be able to redirect a request."""

        class WrongClient(OpenAIStreamingClient):
            pass

        provider_registry = dict(PLAYGROUND_CLIENT_REGISTRY._registry[provider_key])
        provider_registry[model_name] = WrongClient
        provider_registry[PROVIDER_DEFAULT] = WrongClient
        monkeypatch.setitem(PLAYGROUND_CLIENT_REGISTRY._registry, provider_key, provider_registry)

        assert get_openai_client_class(provider_key, model_name, None) is expected_class


class TestChatCompletionsMessageRoles:
    @pytest.mark.parametrize(
        "client_class",
        [OpenAIStreamingClient, AzureOpenAIStreamingClient],
    )
    def test_system_messages_keep_the_system_role(
        self, client_class: type[OpenAIBaseStreamingClient]
    ) -> None:
        """`system` is sent as-is on every model, reasoning included.

        Reasoning models accept `system` and treat it as a `developer` message, so
        rewriting the role gains nothing and costs compatibility with the
        OpenAI-compatible endpoints reachable through a custom base URL.
        """
        message = create_playground_message(ChatCompletionMessageRole.SYSTEM, "be terse")
        param = client_class._to_openai_chat_completion_message_param(None, message)  # type: ignore[arg-type]
        assert param == {"content": "be terse", "role": "system"}


class TestCustomProviderClientSelection:
    """Custom providers select on API type alone, never on the model name.

    The openai SDK config serves any OpenAI-compatible endpoint, so a name matching
    an OpenAI model does not imply OpenAI semantics. Applying the reasoning clients
    here would rewrite ``system`` to ``developer`` against providers that may not
    accept it.
    """

    @pytest.mark.parametrize(
        "openai_api_type,model_name,expected_class",
        [
            ("responses", "gpt-4o", OpenAIResponsesAPIStreamingClient),
            ("responses", "gpt-5.6-luna", OpenAIResponsesAPIStreamingClient),
            ("chat_completions", "gpt-4o", OpenAIStreamingClient),
            ("chat_completions", "gpt-5.6-luna", OpenAIStreamingClient),
        ],
    )
    async def test_openai_custom_provider_selects_on_api_type_only(
        self,
        openai_api_type: str,
        model_name: str,
        expected_class: type[OpenAIBaseStreamingClient],
    ) -> None:
        import phoenix.db.types.model_provider as mp

        config = mp.GenerativeModelCustomerProviderConfig(
            root=mp.OpenAICustomProviderConfig(
                openai_authentication_method=mp.AuthenticationMethodApiKey(api_key="sk-test"),
                openai_api_type=openai_api_type,
            )
        )
        provider_record = models.GenerativeModelCustomProvider(
            name="proxy",
            provider="openai",
            sdk="openai",
            config=config.model_dump_json().encode(),
        )

        client = await _get_custom_provider_client(
            provider_record=provider_record,
            model_name=model_name,
            extra_headers=None,
            decrypt=_identity_decrypt,
        )
        assert type(client) is expected_class


def _identity_decrypt(value: bytes) -> bytes:
    return value


class TestResolveProviderApiKey:
    """The custom-base-URL guard in ``_resolve_provider_api_key``.

    A server-configured (environment variable) API key must never be sent to a
    client-supplied base URL — that would leak the credential to the
    client-controlled host. A key from the request itself or from a DB secret is
    allowed with a custom base URL.
    """

    async def test_input_credential_with_base_url_is_allowed(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("OPENAI_API_KEY", "sk-from-env")
        credentials = [
            GenerativeCredentialInput(
                env_var_name="OPENAI_API_KEY", value=SecretStr("sk-from-input")
            )
        ]
        async with db() as session:
            api_key = await _resolve_provider_api_key(
                credentials=credentials,
                session=session,
                decrypt=_identity_decrypt,
                env_var_name="OPENAI_API_KEY",
                client_base_url="https://attacker.example",
                provider_label="OpenAI",
            )
        assert api_key == "sk-from-input"

    async def test_db_secret_with_base_url_is_allowed(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from phoenix.server.encryption import EncryptionService

        monkeypatch.setenv("OPENAI_API_KEY", "sk-from-env")
        encryption = EncryptionService()
        async with db() as session:
            session.add(
                models.Secret(key="OPENAI_API_KEY", value=encryption.encrypt(b"sk-from-secret"))
            )
            await session.commit()
        async with db() as session:
            api_key = await _resolve_provider_api_key(
                credentials=None,
                session=session,
                decrypt=encryption.decrypt,
                env_var_name="OPENAI_API_KEY",
                client_base_url="https://my-proxy.example",
                provider_label="OpenAI",
            )
        assert api_key == "sk-from-secret"

    async def test_env_var_key_with_base_url_is_rejected(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("OPENAI_API_KEY", "sk-from-env")
        async with db() as session:
            with pytest.raises(BadRequest):
                await _resolve_provider_api_key(
                    credentials=None,
                    session=session,
                    decrypt=_identity_decrypt,
                    env_var_name="OPENAI_API_KEY",
                    client_base_url="https://attacker.example",
                    provider_label="OpenAI",
                )

    async def test_env_var_key_without_base_url_is_allowed(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("OPENAI_API_KEY", "sk-from-env")
        async with db() as session:
            api_key = await _resolve_provider_api_key(
                credentials=None,
                session=session,
                decrypt=_identity_decrypt,
                env_var_name="OPENAI_API_KEY",
                client_base_url=None,
                provider_label="OpenAI",
            )
        assert api_key == "sk-from-env"

    async def test_no_key_with_base_url_returns_none(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        async with db() as session:
            api_key = await _resolve_provider_api_key(
                credentials=None,
                session=session,
                decrypt=_identity_decrypt,
                env_var_name="OPENAI_API_KEY",
                client_base_url="https://my-endpoint.example",
                provider_label="OpenAI",
            )
        assert api_key is None

    async def test_builtin_openai_client_rejects_base_url_with_env_key(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """End-to-end: a custom base URL paired with an env-var-only key is rejected."""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-from-env")
        connection = OpenAIConnectionConfig(
            type="openai",
            base_url="https://attacker.example",
            openai_api_type="chat_completions",
        )
        async with db() as session:
            with pytest.raises(BadRequest):
                await _get_builtin_provider_client(
                    ModelProvider.OPENAI,
                    "gpt-4o",
                    connection,
                    None,
                    session,
                    _identity_decrypt,
                )

    async def test_builtin_openai_client_allows_base_url_with_request_key(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A custom base URL is allowed when the caller supplies their own key."""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-from-env")
        connection = OpenAIConnectionConfig(
            type="openai",
            base_url="https://my-proxy.example",
            openai_api_type="chat_completions",
        )
        credentials = [
            GenerativeCredentialInput(
                env_var_name="OPENAI_API_KEY", value=SecretStr("sk-from-request")
            )
        ]
        async with db() as session:
            client = await _get_builtin_provider_client(
                ModelProvider.OPENAI,
                "gpt-4o",
                connection,
                None,
                session,
                _identity_decrypt,
                credentials,
            )
        assert isinstance(client, OpenAIStreamingClient)
