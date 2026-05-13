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
from opentelemetry.trace import StatusCode, Tracer

from phoenix.db.types.model_provider import LLMClientFactory
from phoenix.db.types.prompts import (
    PromptAnthropicInvocationParameters,
    PromptAnthropicInvocationParametersContent,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptToolChoiceSpecificFunctionTool,
    PromptToolChoiceZeroOrMore,
    PromptToolFunction,
    PromptToolFunctionDefinition,
    PromptTools,
)
from phoenix.server.api.helpers.message_helpers import PlaygroundMessage, create_playground_message
from phoenix.server.api.helpers.playground_clients import (
    AnthropicReasoningStreamingClient,
    AnthropicStreamingClient,
    AzureOpenAIReasoningNonStreamingClient,
    AzureOpenAIResponsesAPIStreamingClient,
    AzureOpenAIStreamingClient,
    Gemini3GoogleStreamingClient,
    Gemini25GoogleStreamingClient,
    GoogleStreamingClient,
    OpenAIBaseStreamingClient,
    OpenAIReasoningNonStreamingClient,
    OpenAIResponsesAPIStreamingClient,
    OpenAIStreamingClient,
    VertexAIAnthropicReasoningStreamingClient,
    VertexAIAnthropicStreamingClient,
    VertexAIGemini3StreamingClient,
    VertexAIGemini20StreamingClient,
    VertexAIGemini25StreamingClient,
    get_openai_client_class,
)
from phoenix.server.api.input_types.ModelClientOptionsInput import OpenAIApiType
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import TextChunk
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
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

        params, _ = client._anthropic_message_params(
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

    def test_openai_chat_completions_reasoning_model_returns_reasoning_client(self) -> None:
        """Reasoning models (o1, o3) with CHAT_COMPLETIONS should return reasoning client."""
        for model_name in ["o1", "o3", "o3-mini"]:
            client_class = get_openai_client_class(
                GenerativeProviderKey.OPENAI,
                model_name,
                OpenAIApiType.CHAT_COMPLETIONS,
            )
            assert client_class is OpenAIReasoningNonStreamingClient, f"Failed for {model_name}"

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

    def test_azure_chat_completions_reasoning_model_returns_reasoning_client(self) -> None:
        """Azure reasoning models with CHAT_COMPLETIONS should return reasoning client."""
        client_class = get_openai_client_class(
            GenerativeProviderKey.AZURE_OPENAI,
            "o1",
            OpenAIApiType.CHAT_COMPLETIONS,
        )
        assert client_class is AzureOpenAIReasoningNonStreamingClient

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


class TestVertexAIGeminiStreamingClient:
    @staticmethod
    def _factory() -> LLMClientFactory[Any]:
        @asynccontextmanager
        async def create_client() -> AsyncIterator[Any]:
            yield None

        return LLMClientFactory(create_client, ("vertex_ai", "test"))

    def test_gemini20_subclass_sets_vertex_ai_provider(self) -> None:
        client = VertexAIGemini20StreamingClient(
            client_factory=self._factory(),
            model_name="gemini-2.0-flash-001",
        )
        assert client.provider == "vertex_ai"
        assert isinstance(client, GoogleStreamingClient)

    def test_gemini25_subclass_sets_vertex_ai_provider(self) -> None:
        client = VertexAIGemini25StreamingClient(
            client_factory=self._factory(),
            model_name="gemini-2.5-pro",
        )
        assert client.provider == "vertex_ai"
        assert isinstance(client, Gemini25GoogleStreamingClient)

    def test_gemini3_subclass_sets_vertex_ai_provider(self) -> None:
        client = VertexAIGemini3StreamingClient(
            client_factory=self._factory(),
            model_name="gemini-3-pro-preview",
        )
        assert client.provider == "vertex_ai"
        assert isinstance(client, Gemini3GoogleStreamingClient)


class TestVertexAIAnthropicStreamingClient:
    @staticmethod
    def _factory() -> LLMClientFactory[Any]:
        @asynccontextmanager
        async def create_client() -> AsyncIterator[Any]:
            yield None

        return LLMClientFactory(create_client, ("vertex_ai", "test"))

    def test_non_reasoning_subclass_sets_vertex_ai_provider(self) -> None:
        client = VertexAIAnthropicStreamingClient(
            client_factory=self._factory(),
            model_name="claude-sonnet-4-6",
        )
        assert client.provider == "vertex_ai"
        assert isinstance(client, AnthropicStreamingClient)

    def test_reasoning_subclass_sets_vertex_ai_provider(self) -> None:
        client = VertexAIAnthropicReasoningStreamingClient(
            client_factory=self._factory(),
            model_name="claude-opus-4-7",
        )
        assert client.provider == "vertex_ai"
        assert isinstance(client, AnthropicReasoningStreamingClient)


class TestGetBuiltinProviderClientVertexAI:
    @pytest.mark.asyncio
    async def test_missing_adc_raises_bad_request_with_hint(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from unittest.mock import AsyncMock, MagicMock, patch

        from google.auth.exceptions import DefaultCredentialsError

        from phoenix.db.types.model_provider import ModelProvider
        from phoenix.server.api.exceptions import BadRequest
        from phoenix.server.api.helpers.playground_clients import _get_builtin_provider_client

        monkeypatch.delenv("GOOGLE_CLOUD_PROJECT", raising=False)
        monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)

        with patch(
            "google.auth.default",
            side_effect=DefaultCredentialsError("no ADC found"),
        ):
            session = MagicMock()
            scalars_result = MagicMock()
            scalars_result.all = MagicMock(return_value=[])
            session.scalars = AsyncMock(return_value=scalars_result)
            decrypt = MagicMock(side_effect=lambda b: b)

            with pytest.raises(BadRequest, match="application-default login"):
                await _get_builtin_provider_client(
                    model_provider=ModelProvider.VERTEX_AI,
                    model_name="gemini-2.5-pro",
                    connection=None,
                    headers=None,
                    session=session,
                    decrypt=decrypt,
                    credentials=None,
                )

    @pytest.mark.asyncio
    async def test_gemini_routes_through_vertex_subclass(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from unittest.mock import AsyncMock, MagicMock, patch

        from phoenix.db.types.model_provider import ModelProvider
        from phoenix.server.api.helpers.playground_clients import _get_builtin_provider_client

        monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-proj")
        monkeypatch.setenv("GOOGLE_CLOUD_LOCATION", "us-central1")

        fake_creds = MagicMock()
        with patch("google.auth.default", return_value=(fake_creds, "test-proj")):
            session = MagicMock()
            scalars_result = MagicMock()
            scalars_result.all = MagicMock(return_value=[])
            session.scalars = AsyncMock(return_value=scalars_result)
            decrypt = MagicMock(side_effect=lambda b: b)

            client = await _get_builtin_provider_client(
                model_provider=ModelProvider.VERTEX_AI,
                model_name="gemini-2.5-pro",
                connection=None,
                headers=None,
                session=session,
                decrypt=decrypt,
                credentials=None,
            )

        assert client.provider == "vertex_ai"
        assert client.__class__.__name__ == "VertexAIGemini25StreamingClient"

    @pytest.mark.asyncio
    async def test_claude_routes_through_vertex_anthropic_subclass(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from unittest.mock import AsyncMock, MagicMock, patch

        from phoenix.db.types.model_provider import ModelProvider
        from phoenix.server.api.helpers.playground_clients import _get_builtin_provider_client

        monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-proj")

        with (
            patch("google.auth.default", return_value=(MagicMock(), "test-proj")),
            patch("anthropic.AsyncAnthropicVertex") as mock_anthropic,
        ):
            mock_anthropic.return_value = MagicMock()
            session = MagicMock()
            scalars_result = MagicMock()
            scalars_result.all = MagicMock(return_value=[])
            session.scalars = AsyncMock(return_value=scalars_result)
            decrypt = MagicMock(side_effect=lambda b: b)

            client = await _get_builtin_provider_client(
                model_provider=ModelProvider.VERTEX_AI,
                model_name="claude-3-5-sonnet-20241022",
                connection=None,
                headers=None,
                session=session,
                decrypt=decrypt,
                credentials=None,
            )

        assert client.provider == "vertex_ai"
        assert client.__class__.__name__ == "VertexAIAnthropicStreamingClient"
