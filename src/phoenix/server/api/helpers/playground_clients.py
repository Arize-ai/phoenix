from __future__ import annotations

import asyncio
import importlib.util
import inspect
import json
import time
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Callable, Iterator
from functools import wraps
from typing import (
    TYPE_CHECKING,
    Any,
    Hashable,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    Union,
)

import sqlalchemy as sa
import wrapt
from openinference.instrumentation import safe_json_dumps
from openinference.semconv.trace import (
    OpenInferenceLLMProviderValues,
    OpenInferenceLLMSystemValues,
    SpanAttributes,
)
from pydantic import ValidationError
from strawberry import UNSET
from strawberry.scalars import JSON as JSONScalarType
from typing_extensions import TypeAlias, assert_never, override

from phoenix.config import getenv
from phoenix.db import models
from phoenix.db.types.model_provider import GenerativeModelCustomerProviderConfig
from phoenix.evals.models.rate_limiters import (
    AsyncCallable,
    GenericType,
    ParameterSpec,
    RateLimiter,
    RateLimitError,
)
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.playground_registry import PROVIDER_DEFAULT, register_llm_client
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.input_types.GenerativeModelInput import (
    GenerativeModelBuiltinProviderInput,
    GenerativeModelCustomProviderInput,
    GenerativeModelInput,
)
from phoenix.server.api.input_types.InvocationParameters import (
    BoundedFloatInvocationParameter,
    CanonicalParameterName,
    FloatInvocationParameter,
    IntInvocationParameter,
    InvocationParameter,
    InvocationParameterInput,
    JSONInvocationParameter,
    StringInvocationParameter,
    StringListInvocationParameter,
    extract_parameter,
    validate_invocation_parameters,
)
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    FunctionCallChunk,
    TextChunk,
    ToolCallChunk,
)
from phoenix.server.api.types.GenerativeProvider import (
    GENERATIVE_PROVIDER_KEY_TO_PROVIDER_STRING,
    GenerativeProviderKey,
)
from phoenix.server.api.types.node import from_global_id
from phoenix.server.types import DbSessionFactory

if TYPE_CHECKING:
    import httpx
    from anthropic import AsyncAnthropic
    from anthropic.types import MessageParam, TextBlockParam, ToolResultBlockParam
    from google import genai
    from google.generativeai.types import ContentType
    from openai import AsyncAzureOpenAI, AsyncOpenAI
    from openai.types import CompletionUsage
    from openai.types.chat import ChatCompletionMessageParam, ChatCompletionMessageToolCallParam
    from opentelemetry.util.types import AttributeValue

SetSpanAttributesFn: TypeAlias = Callable[[Mapping[str, Any]], None]
ChatCompletionChunk: TypeAlias = Union[TextChunk, ToolCallChunk]


class Dependency:
    """
    Set the module_name to the import name if it is different from the install name
    """

    def __init__(self, name: str, module_name: Optional[str] = None):
        self.name = name
        self.module_name = module_name

    @property
    def import_name(self) -> str:
        return self.module_name or self.name


class KeyedSingleton:
    _instances: dict[Hashable, "KeyedSingleton"] = {}

    def __new__(cls, *args: Any, **kwargs: Any) -> "KeyedSingleton":
        if "singleton_key" in kwargs:
            singleton_key = kwargs.pop("singleton_key")
        elif args:
            singleton_key = args[0]
            args = args[1:]
        else:
            raise ValueError("singleton_key must be provided")

        instance_key = (cls, singleton_key)
        if instance_key not in cls._instances:
            instance = super().__new__(cls)
            cls._instances[instance_key] = instance
        return cls._instances[instance_key]


class PlaygroundRateLimiter(RateLimiter, KeyedSingleton):
    """
    A rate rate limiter class that will be instantiated once per `singleton_key`.
    """

    def __init__(self, singleton_key: Hashable, rate_limit_error: Optional[type[BaseException]]):
        super().__init__(
            rate_limit_error=rate_limit_error,
            max_rate_limit_retries=3,
            initial_per_second_request_rate=1.0,
            maximum_per_second_request_rate=3.0,
            enforcement_window_minutes=0.05,
            rate_reduction_factor=0.5,
            rate_increase_factor=0.01,
            cooldown_seconds=5,
            verbose=False,
        )

    # TODO: update the rate limiter class in phoenix.evals to support decorated sync functions
    def _alimit(
        self, fn: Callable[ParameterSpec, GenericType]
    ) -> AsyncCallable[ParameterSpec, GenericType]:
        @wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> GenericType:
            self._initialize_async_primitives()
            assert self._rate_limit_handling_lock is not None and isinstance(
                self._rate_limit_handling_lock, asyncio.Lock
            )
            assert self._rate_limit_handling is not None and isinstance(
                self._rate_limit_handling, asyncio.Event
            )
            try:
                try:
                    await asyncio.wait_for(self._rate_limit_handling.wait(), 120)
                except asyncio.TimeoutError:
                    self._rate_limit_handling.set()  # Set the event as a failsafe
                await self._throttler.async_wait_until_ready()
                request_start_time = time.time()
                maybe_coroutine = fn(*args, **kwargs)
                if inspect.isawaitable(maybe_coroutine):
                    return await maybe_coroutine  # type: ignore[no-any-return]
                else:
                    return maybe_coroutine
            except self._rate_limit_error:
                async with self._rate_limit_handling_lock:
                    self._rate_limit_handling.clear()  # prevent new requests from starting
                    self._throttler.on_rate_limit_error(request_start_time, verbose=self._verbose)
                    try:
                        for _attempt in range(self._max_rate_limit_retries):
                            try:
                                request_start_time = time.time()
                                await self._throttler.async_wait_until_ready()
                                maybe_coroutine = fn(*args, **kwargs)
                                if inspect.isawaitable(maybe_coroutine):
                                    return await maybe_coroutine  # type: ignore[no-any-return]
                                else:
                                    return maybe_coroutine
                            except self._rate_limit_error:
                                self._throttler.on_rate_limit_error(
                                    request_start_time, verbose=self._verbose
                                )
                                continue
                    finally:
                        self._rate_limit_handling.set()  # allow new requests to start
            raise RateLimitError(f"Exceeded max ({self._max_rate_limit_retries}) retries")

        return wrapper


class PlaygroundStreamingClient(ABC):
    def __init__(
        self,
        *,
        client: Any,
        model_name: str,
        provider: str,
    ) -> None:
        self._attributes: dict[str, AttributeValue] = {LLM_PROVIDER: provider}
        self.provider = provider
        self.model_name = model_name
        self.client = client

    @classmethod
    @abstractmethod
    def dependencies(cls) -> list[Dependency]:
        # A list of dependencies this client needs to run
        ...

    @classmethod
    @abstractmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]: ...

    @abstractmethod
    async def chat_completion_create(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
        tools: list[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        # a yield statement is needed to satisfy the type-checker
        # https://mypy.readthedocs.io/en/stable/more_types.html#asynchronous-iterators
        yield TextChunk(content="")

    @classmethod
    def construct_invocation_parameters(
        cls, invocation_parameters: list[InvocationParameterInput]
    ) -> dict[str, Any]:
        supported_params = cls.supported_invocation_parameters()
        params = {param.invocation_name: param for param in supported_params}

        formatted_invocation_parameters = dict()

        for param_input in invocation_parameters:
            invocation_name = param_input.invocation_name
            if invocation_name not in params:
                raise ValueError(f"Unsupported invocation parameter: {invocation_name}")

            param_def = params[invocation_name]
            value = extract_parameter(param_def, param_input)
            if value is not UNSET:
                formatted_invocation_parameters[invocation_name] = value
        validate_invocation_parameters(supported_params, formatted_invocation_parameters)
        return formatted_invocation_parameters

    @classmethod
    def dependencies_are_installed(cls) -> bool:
        try:
            for dependency in cls.dependencies():
                import_name = dependency.import_name
                if importlib.util.find_spec(import_name) is None:
                    return False
            return True
        except ValueError:
            # happens in some cases if the spec is None
            return False

    @property
    def attributes(self) -> dict[str, Any]:
        return self._attributes


class OpenAIBaseStreamingClient(PlaygroundStreamingClient):
    client: Union["AsyncOpenAI", "AsyncAzureOpenAI"]

    def __init__(
        self,
        *,
        client: Union["AsyncOpenAI", "AsyncAzureOpenAI"],
        model_name: str,
        provider: str,
    ) -> None:
        if not model_name:
            raise BadRequest("A model name is required for OpenAI models")
        from openai import RateLimitError as OpenAIRateLimitError

        super().__init__(
            client=client,
            provider=provider,
            model_name=model_name,
        )
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.OPENAI.value
        self.rate_limiter = PlaygroundRateLimiter(provider, OpenAIRateLimitError)
        self.client._client = _HttpxClient(self.client._client, self._attributes)

    @classmethod
    def dependencies(cls) -> list[Dependency]:
        return [Dependency(name="openai")]

    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        return [
            BoundedFloatInvocationParameter(
                invocation_name="temperature",
                canonical_name=CanonicalParameterName.TEMPERATURE,
                label="Temperature",
                default_value=1.0,
                min_value=0.0,
                max_value=2.0,
            ),
            IntInvocationParameter(
                invocation_name="max_tokens",
                canonical_name=CanonicalParameterName.MAX_COMPLETION_TOKENS,
                label="Max Tokens",
            ),
            BoundedFloatInvocationParameter(
                invocation_name="frequency_penalty",
                label="Frequency Penalty",
                default_value=0.0,
                min_value=-2.0,
                max_value=2.0,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="presence_penalty",
                label="Presence Penalty",
                default_value=0.0,
                min_value=-2.0,
                max_value=2.0,
            ),
            StringListInvocationParameter(
                invocation_name="stop",
                canonical_name=CanonicalParameterName.STOP_SEQUENCES,
                label="Stop Sequences",
            ),
            BoundedFloatInvocationParameter(
                invocation_name="top_p",
                canonical_name=CanonicalParameterName.TOP_P,
                label="Top P",
                min_value=0.0,
                max_value=1.0,
            ),
            IntInvocationParameter(
                invocation_name="seed",
                canonical_name=CanonicalParameterName.RANDOM_SEED,
                label="Seed",
            ),
            JSONInvocationParameter(
                invocation_name="tool_choice",
                label="Tool Choice",
                canonical_name=CanonicalParameterName.TOOL_CHOICE,
            ),
            JSONInvocationParameter(
                invocation_name="response_format",
                label="Response Format",
                canonical_name=CanonicalParameterName.RESPONSE_FORMAT,
            ),
            JSONInvocationParameter(
                invocation_name="extra_body",
                label="Extra Body",
            ),
        ]

    async def chat_completion_create(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
        tools: list[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        from openai import NOT_GIVEN
        from openai.types.chat import ChatCompletionStreamOptionsParam

        # Convert standard messages to OpenAI messages
        openai_messages = []
        for message in messages:
            openai_message = self.to_openai_chat_completion_param(*message)
            if openai_message is not None:
                openai_messages.append(openai_message)
        tool_call_ids: dict[int, str] = {}
        token_usage: Optional["CompletionUsage"] = None
        throttled_create = self.rate_limiter._alimit(self.client.chat.completions.create)
        async for chunk in await throttled_create(
            messages=openai_messages,
            model=self.model_name,
            stream=True,
            stream_options=ChatCompletionStreamOptionsParam(include_usage=True),
            tools=tools or NOT_GIVEN,
            **invocation_parameters,
        ):
            if (usage := chunk.usage) is not None:
                token_usage = usage
            if not chunk.choices:
                # for Azure, initial chunk contains the content filter
                continue
            choice = chunk.choices[0]
            delta = choice.delta
            if choice.finish_reason is None:
                if isinstance(chunk_content := delta.content, str):
                    text_chunk = TextChunk(content=chunk_content)
                    yield text_chunk
                if (tool_calls := delta.tool_calls) is not None:
                    for tool_call_index, tool_call in enumerate(tool_calls):
                        tool_call_id = (
                            tool_call.id
                            if tool_call.id is not None
                            else tool_call_ids[tool_call_index]
                        )
                        tool_call_ids[tool_call_index] = tool_call_id
                        if (function := tool_call.function) is not None:
                            tool_call_chunk = ToolCallChunk(
                                id=tool_call_id,
                                function=FunctionCallChunk(
                                    name=function.name or "",
                                    arguments=function.arguments or "",
                                ),
                            )
                            yield tool_call_chunk
        if token_usage is not None:
            self._attributes.update(dict(self._llm_token_counts(token_usage)))

    def to_openai_chat_completion_param(
        self,
        role: ChatCompletionMessageRole,
        content: JSONScalarType,
        tool_call_id: Optional[str] = None,
        tool_calls: Optional[list[JSONScalarType]] = None,
    ) -> Optional["ChatCompletionMessageParam"]:
        from openai.types.chat import (
            ChatCompletionAssistantMessageParam,
            ChatCompletionSystemMessageParam,
            ChatCompletionToolMessageParam,
            ChatCompletionUserMessageParam,
        )

        if role is ChatCompletionMessageRole.USER:
            return ChatCompletionUserMessageParam(
                {
                    "content": content,
                    "role": "user",
                }
            )
        if role is ChatCompletionMessageRole.SYSTEM:
            return ChatCompletionSystemMessageParam(
                {
                    "content": content,
                    "role": "system",
                }
            )
        if role is ChatCompletionMessageRole.AI:
            if tool_calls is None:
                return ChatCompletionAssistantMessageParam(
                    {
                        "content": content,
                        "role": "assistant",
                    }
                )
            else:
                return ChatCompletionAssistantMessageParam(
                    {
                        "content": content,
                        "role": "assistant",
                        "tool_calls": [
                            self.to_openai_tool_call_param(tool_call) for tool_call in tool_calls
                        ],
                    }
                )
        if role is ChatCompletionMessageRole.TOOL:
            if tool_call_id is None:
                raise ValueError("tool_call_id is required for tool messages")
            return ChatCompletionToolMessageParam(
                {"content": content, "role": "tool", "tool_call_id": tool_call_id}
            )
        assert_never(role)

    def to_openai_tool_call_param(
        self,
        tool_call: JSONScalarType,
    ) -> "ChatCompletionMessageToolCallParam":
        from openai.types.chat import ChatCompletionMessageToolCallParam

        return ChatCompletionMessageToolCallParam(
            id=tool_call.get("id", ""),
            function={
                "name": tool_call.get("function", {}).get("name", ""),
                "arguments": safe_json_dumps(tool_call.get("function", {}).get("arguments", "")),
            },
            type="function",
        )

    @staticmethod
    def _llm_token_counts(usage: "CompletionUsage") -> Iterator[tuple[str, Any]]:
        yield LLM_TOKEN_COUNT_PROMPT, usage.prompt_tokens
        yield LLM_TOKEN_COUNT_COMPLETION, usage.completion_tokens
        yield LLM_TOKEN_COUNT_TOTAL, usage.total_tokens

        if hasattr(usage, "prompt_tokens_details") and usage.prompt_tokens_details is not None:
            prompt_details = usage.prompt_tokens_details
            if (
                hasattr(prompt_details, "cached_tokens")
                and prompt_details.cached_tokens is not None
            ):
                yield LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ, prompt_details.cached_tokens
            if hasattr(prompt_details, "audio_tokens") and prompt_details.audio_tokens is not None:
                yield LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO, prompt_details.audio_tokens

        if (
            hasattr(usage, "completion_tokens_details")
            and usage.completion_tokens_details is not None
        ):
            completion_details = usage.completion_tokens_details
            if (
                hasattr(completion_details, "reasoning_tokens")
                and completion_details.reasoning_tokens is not None
            ):
                yield (
                    LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING,
                    completion_details.reasoning_tokens,
                )
            if (
                hasattr(completion_details, "audio_tokens")
                and completion_details.audio_tokens is not None
            ):
                yield LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO, completion_details.audio_tokens


@register_llm_client(
    provider_key=GenerativeProviderKey.DEEPSEEK,
    model_names=[
        PROVIDER_DEFAULT,
        "deepseek-chat",
        "deepseek-reasoner",
    ],
)
class DeepSeekStreamingClient(OpenAIBaseStreamingClient):
    pass


@register_llm_client(
    provider_key=GenerativeProviderKey.XAI,
    model_names=[
        PROVIDER_DEFAULT,
        "grok-3",
        "grok-3-fast",
        "grok-3-mini",
        "grok-3-mini-fast",
        "grok-2-1212",
        "grok-2-vision-1212",
    ],
)
class XAIStreamingClient(OpenAIBaseStreamingClient):
    pass


@register_llm_client(
    provider_key=GenerativeProviderKey.OLLAMA,
    model_names=[
        PROVIDER_DEFAULT,
        "llama3.3",
        "llama3.2",
        "llama3.1",
        "llama3",
        "llama2",
        "mistral",
        "mixtral",
        "codellama",
        "phi3",
        "qwen2.5",
        "gemma2",
    ],
)
class OllamaStreamingClient(OpenAIBaseStreamingClient):
    pass


@register_llm_client(
    provider_key=GenerativeProviderKey.AWS,
    model_names=[
        PROVIDER_DEFAULT,
        "anthropic.claude-opus-4-6-v1",
        "anthropic.claude-opus-4-5-20251101-v1:0",
        "anthropic.claude-sonnet-4-5-20250929-v1:0",
        "anthropic.claude-haiku-4-5-20251001-v1:0",
        "anthropic.claude-opus-4-1-20250805-v1:0",
        "anthropic.claude-opus-4-20250514-v1:0",
        "anthropic.claude-sonnet-4-20250514-v1:0",
        "anthropic.claude-3-7-sonnet-20250219-v1:0",
        "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "anthropic.claude-3-5-sonnet-20240620-v1:0",
        "anthropic.claude-3-5-haiku-20241022-v1:0",
        "anthropic.claude-3-haiku-20240307-v1:0",
        "amazon.titan-embed-text-v2:0",
        "amazon.nova-pro-v1:0",
        "amazon.nova-premier-v1:0:8k",
        "amazon.nova-premier-v1:0:20k",
        "amazon.nova-premier-v1:0:1000k",
        "amazon.nova-premier-v1:0:mm",
        "amazon.nova-premier-v1:0",
        "amazon.nova-lite-v1:0",
        "amazon.nova-micro-v1:0",
        "deepseek.r1-v1:0",
        "mistral.pixtral-large-2502-v1:0",
        "meta.llama3-1-8b-instruct-v1:0:128k",
        "meta.llama3-1-8b-instruct-v1:0",
        "meta.llama3-1-70b-instruct-v1:0:128k",
        "meta.llama3-1-70b-instruct-v1:0",
        "meta.llama3-1-405b-instruct-v1:0",
        "meta.llama3-2-11b-instruct-v1:0",
        "meta.llama3-2-90b-instruct-v1:0",
        "meta.llama3-2-1b-instruct-v1:0",
        "meta.llama3-2-3b-instruct-v1:0",
        "meta.llama3-3-70b-instruct-v1:0",
        "meta.llama4-scout-17b-instruct-v1:0",
        "meta.llama4-maverick-17b-instruct-v1:0",
    ],
)
class BedrockStreamingClient(PlaygroundStreamingClient):
    def __init__(
        self,
        *,
        client: Any,
        model_name: str,
        provider: str = "aws",
    ) -> None:
        super().__init__(client=client, model_name=model_name, provider=provider)
        self._attributes[LLM_SYSTEM] = "aws"

    @classmethod
    def dependencies(cls) -> list[Dependency]:
        return [Dependency(name="boto3")]

    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        return [
            IntInvocationParameter(
                invocation_name="max_tokens",
                canonical_name=CanonicalParameterName.MAX_COMPLETION_TOKENS,
                label="Max Tokens",
                default_value=1024,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="temperature",
                canonical_name=CanonicalParameterName.TEMPERATURE,
                label="Temperature",
                default_value=1.0,
                min_value=0.0,
                max_value=1.0,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="top_p",
                canonical_name=CanonicalParameterName.TOP_P,
                label="Top P",
                min_value=0.0,
                max_value=1.0,
            ),
            JSONInvocationParameter(
                invocation_name="tool_choice",
                label="Tool Choice",
                canonical_name=CanonicalParameterName.TOOL_CHOICE,
            ),
        ]

    async def chat_completion_create(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
        tools: list[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        async for chunk in self._handle_converse_api(messages, tools, invocation_parameters):
            yield chunk

    async def _handle_converse_api(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
        tools: list[JSONScalarType],
        invocation_parameters: dict[str, Any],
    ) -> AsyncIterator[ChatCompletionChunk]:
        """
        Handle the converse API.
        """
        # Build messages in Converse API format
        converse_messages = self._build_converse_messages(messages)

        inference_config = {}
        if (
            "max_tokens" in invocation_parameters
            and invocation_parameters["max_tokens"] is not None
        ):
            inference_config["maxTokens"] = invocation_parameters["max_tokens"]
        if (
            "temperature" in invocation_parameters
            and invocation_parameters["temperature"] is not None
        ):
            inference_config["temperature"] = invocation_parameters["temperature"]
        if "top_p" in invocation_parameters and invocation_parameters["top_p"] is not None:
            inference_config["topP"] = invocation_parameters["top_p"]

        # Build the request parameters for Converse API
        converse_params: dict[str, Any] = {
            "modelId": self.model_name,
            "messages": converse_messages,
            "inferenceConfig": inference_config,
        }

        # Add system prompt if available
        system_prompt = self._extract_system_prompt(messages)
        if system_prompt:
            converse_params["system"] = [{"text": system_prompt}]

        # Add tools if provided
        if tools:
            converse_params["toolConfig"] = {"tools": tools}
            if (
                "tool_choice" in invocation_parameters
                and invocation_parameters["tool_choice"]["type"] != "none"
            ):
                converse_params["toolConfig"]["toolChoice"] = {}

                if invocation_parameters["tool_choice"]["type"] == "auto":
                    converse_params["toolConfig"]["toolChoice"]["auto"] = {}
                elif invocation_parameters["tool_choice"]["type"] == "any":
                    converse_params["toolConfig"]["toolChoice"]["any"] = {}
                else:
                    converse_params["toolConfig"]["toolChoice"]["tool"] = {
                        "name": invocation_parameters["tool_choice"]["name"],
                    }

        # Make the streaming API call
        response = self.client.converse_stream(**converse_params)

        # Track active tool calls
        active_tool_calls = {}  # contentBlockIndex -> {id, name, arguments_buffer}

        # Process the event stream
        event_stream = response.get("stream")

        for event in event_stream:
            # Handle content block start events
            if "contentBlockStart" in event:
                content_block_start = event["contentBlockStart"]
                start_event = content_block_start.get("start", {})
                block_index = content_block_start.get(
                    "contentBlockIndex", 0
                )  # Get the actual index

                if "toolUse" in start_event:
                    tool_use = start_event["toolUse"]
                    active_tool_calls[block_index] = {  # Use the actual block index
                        "id": tool_use.get("toolUseId"),
                        "name": tool_use.get("name"),
                        "arguments_buffer": "",
                    }

                    # Yield initial tool call chunk
                    yield ToolCallChunk(
                        id=tool_use.get("toolUseId"),
                        function=FunctionCallChunk(
                            name=tool_use.get("name"),
                            arguments="",
                        ),
                    )

            # Handle content block delta events
            elif "contentBlockDelta" in event:
                content_delta = event["contentBlockDelta"]
                delta = content_delta.get("delta", {})
                delta_index = content_delta.get("contentBlockIndex", 0)

                # Handle text delta
                if "text" in delta:
                    yield TextChunk(content=delta["text"])

                # Handle tool use delta
                elif "toolUse" in delta:
                    tool_delta = delta["toolUse"]
                    if "input" in tool_delta and delta_index in active_tool_calls:
                        # Accumulate tool arguments
                        json_chunk = tool_delta["input"]
                        active_tool_calls[delta_index]["arguments_buffer"] += json_chunk

                        # Yield incremental argument update
                        yield ToolCallChunk(
                            id=active_tool_calls[delta_index]["id"],
                            function=FunctionCallChunk(
                                name=active_tool_calls[delta_index]["name"],
                                arguments=json_chunk,
                            ),
                        )

            # Handle content block stop events
            elif "contentBlockStop" in event:
                stop_index = event["contentBlockStop"].get("contentBlockIndex", 0)
                if stop_index in active_tool_calls:
                    del active_tool_calls[stop_index]

            elif "metadata" in event:
                self._attributes.update(
                    {
                        LLM_TOKEN_COUNT_PROMPT: event.get("metadata")
                        .get("usage", {})
                        .get("inputTokens", 0)
                    }
                )

                self._attributes.update(
                    {
                        LLM_TOKEN_COUNT_COMPLETION: event.get("metadata")
                        .get("usage", {})
                        .get("outputTokens", 0)
                    }
                )

                self._attributes.update(
                    {
                        LLM_TOKEN_COUNT_TOTAL: event.get("metadata")
                        .get("usage", {})
                        .get("totalTokens", 0)
                    }
                )

    async def _handle_invoke_api(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
        tools: list[JSONScalarType],
        invocation_parameters: dict[str, Any],
    ) -> AsyncIterator[ChatCompletionChunk]:
        if "anthropic" not in self.model_name:
            raise ValueError("Invoke API is only supported for Anthropic models")

        bedrock_messages, system_prompt = self._build_bedrock_messages(messages)
        bedrock_params = {
            "anthropic_version": "bedrock-2023-05-31",
            "messages": bedrock_messages,
            "system": system_prompt,
            "tools": tools,
        }

        if (
            "max_tokens" in invocation_parameters
            and invocation_parameters["max_tokens"] is not None
        ):
            bedrock_params["max_tokens"] = invocation_parameters["max_tokens"]
        if (
            "temperature" in invocation_parameters
            and invocation_parameters["temperature"] is not None
        ):
            bedrock_params["temperature"] = invocation_parameters["temperature"]
        if "top_p" in invocation_parameters and invocation_parameters["top_p"] is not None:
            bedrock_params["top_p"] = invocation_parameters["top_p"]

        response = self.client.invoke_model_with_response_stream(
            modelId=self.model_name,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(bedrock_params),
            trace="ENABLED_FULL",
        )

        # The response['body'] is an EventStream object
        event_stream = response["body"]

        # Track active tool calls and their accumulating arguments
        active_tool_calls: dict[int, dict[str, Any]] = {}  # index -> {id, name, arguments_buffer}

        for event in event_stream:
            if "chunk" in event:
                chunk_data = json.loads(event["chunk"]["bytes"].decode("utf-8"))

                # Handle text content
                if chunk_data.get("type") == "content_block_delta":
                    delta = chunk_data.get("delta", {})
                    index = chunk_data.get("index", 0)

                    if delta.get("type") == "text_delta" and "text" in delta:
                        yield TextChunk(content=delta["text"])

                    elif delta.get("type") == "input_json_delta":
                        # Accumulate tool arguments
                        if index in active_tool_calls:
                            active_tool_calls[index]["arguments_buffer"] += delta.get(
                                "partial_json", ""
                            )
                            # Yield incremental argument update
                            yield ToolCallChunk(
                                id=active_tool_calls[index]["id"],
                                function=FunctionCallChunk(
                                    name=active_tool_calls[index]["name"],
                                    arguments=delta.get("partial_json", ""),
                                ),
                            )

                # Handle tool call start
                elif chunk_data.get("type") == "content_block_start":
                    content_block = chunk_data.get("content_block", {})
                    index = chunk_data.get("index", 0)

                    if content_block.get("type") == "tool_use":
                        # Initialize tool call tracking
                        active_tool_calls[index] = {
                            "id": content_block.get("id"),
                            "name": content_block.get("name"),
                            "arguments_buffer": "",
                        }

                        # Yield initial tool call chunk
                        yield ToolCallChunk(
                            id=content_block.get("id"),
                            function=FunctionCallChunk(
                                name=content_block.get("name"),
                                arguments="",  # Start with empty, will be filled by deltas
                            ),
                        )

                # Handle content block stop (tool call complete)
                elif chunk_data.get("type") == "content_block_stop":
                    index = chunk_data.get("index", 0)
                    if index in active_tool_calls:
                        # Tool call is complete, clean up
                        del active_tool_calls[index]

                elif chunk_data.get("type") == "message_stop":
                    self._attributes.update(
                        {
                            LLM_TOKEN_COUNT_COMPLETION: chunk_data.get(
                                "amazon-bedrock-invocationMetrics", {}
                            ).get("outputTokenCount", 0)
                        }
                    )

                    self._attributes.update(
                        {
                            LLM_TOKEN_COUNT_PROMPT: chunk_data.get(
                                "amazon-bedrock-invocationMetrics", {}
                            ).get("inputTokenCount", 0)
                        }
                    )

    def _build_bedrock_messages(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
    ) -> tuple[list[dict[str, Any]], str]:
        bedrock_messages = []
        system_prompt = ""
        for role, content, _, _ in messages:
            if role == ChatCompletionMessageRole.USER:
                bedrock_messages.append(
                    {
                        "role": "user",
                        "content": content,
                    }
                )
            elif role == ChatCompletionMessageRole.AI:
                bedrock_messages.append(
                    {
                        "role": "assistant",
                        "content": content,
                    }
                )
            elif role == ChatCompletionMessageRole.SYSTEM:
                system_prompt += content + "\n"
        return bedrock_messages, system_prompt

    def _extract_system_prompt(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
    ) -> str:
        """Extract system prompt from messages."""
        system_prompts = []
        for role, content, _, _ in messages:
            if role == ChatCompletionMessageRole.SYSTEM:
                system_prompts.append(content)
        return "\n".join(system_prompts)

    def _build_converse_messages(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
    ) -> list[dict[str, Any]]:
        """Convert messages to Converse API format."""
        converse_messages: list[dict[str, Any]] = []
        for role, content, _id, tool_calls in messages:
            if role == ChatCompletionMessageRole.USER:
                converse_messages.append({"role": "user", "content": [{"text": content}]})
            elif role == ChatCompletionMessageRole.TOOL:
                converse_messages.append(
                    {
                        "role": "user",
                        "content": [
                            {
                                "toolResult": {
                                    "toolUseId": _id,
                                    "content": [{"json": json.loads(content)}],
                                }
                            }
                        ],
                    }
                )

            elif role == ChatCompletionMessageRole.AI:
                # Handle assistant messages with potential tool calls
                message: dict[str, Any] = {"role": "assistant", "content": []}
                if content:
                    message["content"].append({"text": content})
                if tool_calls:
                    for tool_call in tool_calls:
                        message["content"].append(tool_call)
                converse_messages.append(message)
        return converse_messages


@register_llm_client(
    provider_key=GenerativeProviderKey.OPENAI,
    model_names=[
        PROVIDER_DEFAULT,
        "gpt-4.1",
        "gpt-4.1-mini",
        "gpt-4.1-nano",
        "gpt-4.1-2025-04-14",
        "gpt-4.1-mini-2025-04-14",
        "gpt-4.1-nano-2025-04-14",
        "gpt-4o",
        "gpt-4o-2024-11-20",
        "gpt-4o-2024-08-06",
        "gpt-4o-2024-05-13",
        "chatgpt-4o-latest",
        "gpt-4o-mini",
        "gpt-4o-mini-2024-07-18",
        "gpt-4-turbo",
        "gpt-4-turbo-2024-04-09",
        "gpt-4-turbo-preview",
        "gpt-4-0125-preview",
        "gpt-4-1106-preview",
        "gpt-4",
        "gpt-4-0613",
        "gpt-3.5-turbo-0125",
        "gpt-3.5-turbo",
        "gpt-3.5-turbo-1106",
        # preview models
        "gpt-4.5-preview",
    ],
)
class OpenAIStreamingClient(OpenAIBaseStreamingClient):
    pass


OPENAI_REASONING_MODELS = [
    "gpt-5.2",
    "gpt-5.2-2025-12-11",
    "gpt-5.2-chat-latest",
    "gpt-5.1",
    "gpt-5.1-2025-11-13",
    "gpt-5.1-chat-latest",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5-chat-latest",
    "o1",
    "o1-pro",
    "o1-2024-12-17",
    "o1-pro-2025-03-19",
    "o1-mini",
    "o1-mini-2024-09-12",
    "o1-preview",
    "o1-preview-2024-09-12",
    "o3",
    "o3-pro",
    "o3-2025-04-16",
    "o3-mini",
    "o3-mini-2025-01-31",
    "o4-mini",
    "o4-mini-2025-04-16",
]


class OpenAIReasoningReasoningModelsMixin:
    """Mixin class for OpenAI-style reasoning model clients (o1, o3 series)."""

    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        return [
            StringInvocationParameter(
                invocation_name="reasoning_effort",
                label="Reasoning Effort",
                canonical_name=CanonicalParameterName.REASONING_EFFORT,
            ),
            IntInvocationParameter(
                invocation_name="max_completion_tokens",
                canonical_name=CanonicalParameterName.MAX_COMPLETION_TOKENS,
                label="Max Completion Tokens",
            ),
            IntInvocationParameter(
                invocation_name="seed",
                canonical_name=CanonicalParameterName.RANDOM_SEED,
                label="Seed",
            ),
            JSONInvocationParameter(
                invocation_name="tool_choice",
                label="Tool Choice",
                canonical_name=CanonicalParameterName.TOOL_CHOICE,
            ),
            JSONInvocationParameter(
                invocation_name="response_format",
                label="Response Format",
                canonical_name=CanonicalParameterName.RESPONSE_FORMAT,
            ),
            JSONInvocationParameter(
                invocation_name="extra_body",
                label="Extra Body",
            ),
        ]


@register_llm_client(
    provider_key=GenerativeProviderKey.OPENAI,
    model_names=OPENAI_REASONING_MODELS,
)
class OpenAIReasoningNonStreamingClient(
    OpenAIReasoningReasoningModelsMixin,
    OpenAIStreamingClient,
):
    def to_openai_chat_completion_param(
        self,
        role: ChatCompletionMessageRole,
        content: JSONScalarType,
        tool_call_id: Optional[str] = None,
        tool_calls: Optional[list[JSONScalarType]] = None,
    ) -> Optional["ChatCompletionMessageParam"]:
        from openai.types.chat import (
            ChatCompletionAssistantMessageParam,
            ChatCompletionDeveloperMessageParam,
            ChatCompletionToolMessageParam,
            ChatCompletionUserMessageParam,
        )

        if role is ChatCompletionMessageRole.USER:
            return ChatCompletionUserMessageParam(
                {
                    "content": content,
                    "role": "user",
                }
            )
        if role is ChatCompletionMessageRole.SYSTEM:
            return ChatCompletionDeveloperMessageParam(
                {
                    "content": content,
                    "role": "developer",
                }
            )
        if role is ChatCompletionMessageRole.AI:
            if tool_calls is None:
                return ChatCompletionAssistantMessageParam(
                    {
                        "content": content,
                        "role": "assistant",
                    }
                )
            else:
                return ChatCompletionAssistantMessageParam(
                    {
                        "content": content,
                        "role": "assistant",
                        "tool_calls": [
                            self.to_openai_tool_call_param(tool_call) for tool_call in tool_calls
                        ],
                    }
                )
        if role is ChatCompletionMessageRole.TOOL:
            if tool_call_id is None:
                raise ValueError("tool_call_id is required for tool messages")
            return ChatCompletionToolMessageParam(
                {"content": content, "role": "tool", "tool_call_id": tool_call_id}
            )
        assert_never(role)


@register_llm_client(
    provider_key=GenerativeProviderKey.AZURE_OPENAI,
    model_names=[
        PROVIDER_DEFAULT,
    ],
)
class AzureOpenAIStreamingClient(OpenAIBaseStreamingClient):
    def __init__(
        self,
        *,
        client: "AsyncAzureOpenAI",
        model_name: str,
        provider: str = "azure",
    ) -> None:
        super().__init__(client=client, model_name=model_name, provider=provider)
        self._attributes[LLM_PROVIDER] = OpenInferenceLLMProviderValues.AZURE.value
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.OPENAI.value


@register_llm_client(
    provider_key=GenerativeProviderKey.AZURE_OPENAI,
    model_names=OPENAI_REASONING_MODELS,
)
class AzureOpenAIReasoningNonStreamingClient(
    OpenAIReasoningReasoningModelsMixin,
    AzureOpenAIStreamingClient,
):
    @override
    async def chat_completion_create(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
        tools: list[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        from openai import NOT_GIVEN

        # Convert standard messages to OpenAI messages
        openai_messages = []
        for message in messages:
            openai_message = self.to_openai_chat_completion_param(*message)
            if openai_message is not None:
                openai_messages.append(openai_message)

        throttled_create = self.rate_limiter._alimit(self.client.chat.completions.create)
        response = await throttled_create(
            messages=openai_messages,
            model=self.model_name,
            stream=False,
            tools=tools or NOT_GIVEN,
            **invocation_parameters,
        )

        if response.usage is not None:
            self._attributes.update(dict(self._llm_token_counts(response.usage)))

        choice = response.choices[0]
        if choice.message.content:
            yield TextChunk(content=choice.message.content)

        if choice.message.tool_calls:
            for tool_call in choice.message.tool_calls:
                yield ToolCallChunk(
                    id=tool_call.id,
                    function=FunctionCallChunk(
                        name=tool_call.function.name,
                        arguments=tool_call.function.arguments,
                    ),
                )

    def to_openai_chat_completion_param(
        self,
        role: ChatCompletionMessageRole,
        content: JSONScalarType,
        tool_call_id: Optional[str] = None,
        tool_calls: Optional[list[JSONScalarType]] = None,
    ) -> Optional["ChatCompletionMessageParam"]:
        from openai.types.chat import (
            ChatCompletionAssistantMessageParam,
            ChatCompletionDeveloperMessageParam,
            ChatCompletionToolMessageParam,
            ChatCompletionUserMessageParam,
        )

        if role is ChatCompletionMessageRole.USER:
            return ChatCompletionUserMessageParam(
                {
                    "content": content,
                    "role": "user",
                }
            )
        if role is ChatCompletionMessageRole.SYSTEM:
            return ChatCompletionDeveloperMessageParam(
                {
                    "content": content,
                    "role": "developer",
                }
            )
        if role is ChatCompletionMessageRole.AI:
            if tool_calls is None:
                return ChatCompletionAssistantMessageParam(
                    {
                        "content": content,
                        "role": "assistant",
                    }
                )
            else:
                return ChatCompletionAssistantMessageParam(
                    {
                        "content": content,
                        "role": "assistant",
                        "tool_calls": [
                            self.to_openai_tool_call_param(tool_call) for tool_call in tool_calls
                        ],
                    }
                )
        if role is ChatCompletionMessageRole.TOOL:
            if tool_call_id is None:
                raise ValueError("tool_call_id is required for tool messages")
            return ChatCompletionToolMessageParam(
                {"content": content, "role": "tool", "tool_call_id": tool_call_id}
            )
        assert_never(role)


@register_llm_client(
    provider_key=GenerativeProviderKey.ANTHROPIC,
    model_names=[
        PROVIDER_DEFAULT,
        "claude-3-5-haiku-latest",
        "claude-3-5-haiku-20241022",
        "claude-3-haiku-20240307",
    ],
)
class AnthropicStreamingClient(PlaygroundStreamingClient):
    def __init__(
        self,
        *,
        client: "AsyncAnthropic",
        model_name: str,
        provider: str = "anthropic",
    ) -> None:
        import anthropic

        super().__init__(client=client, model_name=model_name, provider=provider)
        self._attributes[LLM_PROVIDER] = OpenInferenceLLMProviderValues.ANTHROPIC.value
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.ANTHROPIC.value
        self.rate_limiter = PlaygroundRateLimiter(provider, anthropic.RateLimitError)
        self.client._client = _HttpxClient(self.client._client, self._attributes)

    @classmethod
    def dependencies(cls) -> list[Dependency]:
        return [Dependency(name="anthropic")]

    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        return [
            IntInvocationParameter(
                invocation_name="max_tokens",
                canonical_name=CanonicalParameterName.MAX_COMPLETION_TOKENS,
                label="Max Tokens",
                default_value=1024,
                required=True,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="temperature",
                canonical_name=CanonicalParameterName.TEMPERATURE,
                label="Temperature",
                default_value=1.0,
                min_value=0.0,
                max_value=1.0,
            ),
            StringListInvocationParameter(
                invocation_name="stop_sequences",
                canonical_name=CanonicalParameterName.STOP_SEQUENCES,
                label="Stop Sequences",
            ),
            BoundedFloatInvocationParameter(
                invocation_name="top_p",
                canonical_name=CanonicalParameterName.TOP_P,
                label="Top P",
                min_value=0.0,
                max_value=1.0,
            ),
            JSONInvocationParameter(
                invocation_name="tool_choice",
                label="Tool Choice",
                canonical_name=CanonicalParameterName.TOOL_CHOICE,
            ),
        ]

    async def chat_completion_create(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
        tools: list[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        anthropic_messages, system_prompt = self._build_anthropic_messages(messages)
        anthropic_params = {
            "messages": anthropic_messages,
            "model": self.model_name,
            "system": system_prompt,
            "tools": tools,
            **invocation_parameters,
        }
        throttled_stream = self.rate_limiter._alimit(self.client.messages.stream)
        async with await throttled_stream(**anthropic_params) as stream:
            async for event in stream:
                if event.type == "message_start":
                    usage = event.message.usage

                    token_counts: dict[str, Any] = {}
                    if prompt_tokens := (
                        (usage.input_tokens or 0)
                        + (getattr(usage, "cache_creation_input_tokens", 0) or 0)
                        + (getattr(usage, "cache_read_input_tokens", 0) or 0)
                    ):
                        token_counts[LLM_TOKEN_COUNT_PROMPT] = prompt_tokens
                    if cache_creation_tokens := getattr(usage, "cache_creation_input_tokens", None):
                        if cache_creation_tokens is not None:
                            token_counts[LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE] = (
                                cache_creation_tokens
                            )
                    self._attributes.update(token_counts)
                elif event.type == "text":
                    yield TextChunk(content=event.text)
                elif event.type == "message_stop":
                    usage = event.message.usage
                    output_token_counts: dict[str, Any] = {}
                    if usage.output_tokens:
                        output_token_counts[LLM_TOKEN_COUNT_COMPLETION] = usage.output_tokens
                    if cache_read_tokens := getattr(usage, "cache_read_input_tokens", None):
                        if cache_read_tokens is not None:
                            output_token_counts[LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ] = (
                                cache_read_tokens
                            )
                    self._attributes.update(output_token_counts)
                elif event.type == "content_block_stop" and event.content_block.type == "tool_use":
                    tool_call_chunk = ToolCallChunk(
                        id=event.content_block.id,
                        function=FunctionCallChunk(
                            name=event.content_block.name,
                            arguments=json.dumps(event.content_block.input),
                        ),
                    )
                    yield tool_call_chunk
                elif event.type == "content_block_start":
                    pass
                elif event.type == "content_block_delta":
                    pass
                elif event.type == "message_delta":
                    pass
                elif event.type == "content_block_stop":
                    # non-tool_use case; tool_use already yielded above
                    pass
                elif event.type == "input_json":
                    # Incremental tool-call JSON; we use the complete block at content_block_stop
                    pass
                elif event.type == "citation":
                    pass
                elif event.type == "thinking":
                    pass
                elif event.type == "signature":
                    pass
                elif TYPE_CHECKING:
                    assert_never(event)

    def _build_anthropic_messages(
        self,
        messages: list[tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]]],
    ) -> tuple[list["MessageParam"], str]:
        anthropic_messages: list["MessageParam"] = []
        system_prompt = ""
        for role, content, _tool_call_id, _tool_calls in messages:
            tool_aware_content = self._anthropic_message_content(content, _tool_calls)
            if role == ChatCompletionMessageRole.USER:
                anthropic_messages.append({"role": "user", "content": tool_aware_content})
            elif role == ChatCompletionMessageRole.AI:
                anthropic_messages.append({"role": "assistant", "content": tool_aware_content})
            elif role == ChatCompletionMessageRole.SYSTEM:
                system_prompt += content + "\n"
            elif role == ChatCompletionMessageRole.TOOL:
                anthropic_messages.append(
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "tool_result",
                                "tool_use_id": _tool_call_id or "",
                                "content": content or "",
                            }
                        ],
                    }
                )
            else:
                assert_never(role)

        return anthropic_messages, system_prompt

    def _anthropic_message_content(
        self, content: str, tool_calls: Optional[list[JSONScalarType]]
    ) -> Union[str, list[Union["ToolResultBlockParam", "TextBlockParam"]]]:
        if tool_calls:
            # Anthropic combines tool calls and the reasoning text into a single message object
            tool_use_content: list[Union["ToolResultBlockParam", "TextBlockParam"]] = []
            if content:
                tool_use_content.append({"type": "text", "text": content})
            tool_use_content.extend(tool_calls)
            return tool_use_content

        return content


ANTHROPIC_REASONING_MODELS = [
    "claude-opus-4-5",
    "claude-opus-4-5-20251101",
    "claude-sonnet-4-5",
    "claude-sonnet-4-5-20250929",
    "claude-haiku-4-5",
    "claude-haiku-4-5-20251001",
    "claude-opus-4-1",
    "claude-opus-4-1-20250805",
    "claude-sonnet-4-0",
    "claude-sonnet-4-20250514",
    "claude-opus-4-0",
    "claude-opus-4-20250514",
    "claude-3-7-sonnet-latest",
    "claude-3-7-sonnet-20250219",
]


@register_llm_client(
    provider_key=GenerativeProviderKey.ANTHROPIC,
    model_names=ANTHROPIC_REASONING_MODELS,
)
class AnthropicReasoningStreamingClient(AnthropicStreamingClient):
    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        invocation_params = super().supported_invocation_parameters()
        invocation_params.append(
            JSONInvocationParameter(
                invocation_name="thinking",
                canonical_name=CanonicalParameterName.ANTHROPIC_EXTENDED_THINKING,
                label="Thinking Budget",
            )
        )
        return invocation_params


@register_llm_client(
    provider_key=GenerativeProviderKey.GOOGLE,
    model_names=[
        PROVIDER_DEFAULT,
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash-001",
        "gemini-2.0-flash-thinking-exp-01-21",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.5-pro",
        "gemini-1.0-pro",
    ],
)
class GoogleStreamingClient(PlaygroundStreamingClient):
    def __init__(
        self,
        *,
        client: "genai.Client",
        model_name: str,
        provider: str = "google",
    ) -> None:
        super().__init__(client=client, model_name=model_name, provider=provider)
        self._attributes[LLM_PROVIDER] = OpenInferenceLLMProviderValues.GOOGLE.value
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.VERTEXAI.value

    @classmethod
    def dependencies(cls) -> list[Dependency]:
        return [Dependency(name="google-genai", module_name="google.genai")]

    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        return [
            BoundedFloatInvocationParameter(
                invocation_name="temperature",
                canonical_name=CanonicalParameterName.TEMPERATURE,
                label="Temperature",
                default_value=1.0,
                min_value=0.0,
                max_value=2.0,
            ),
            IntInvocationParameter(
                invocation_name="max_output_tokens",
                canonical_name=CanonicalParameterName.MAX_COMPLETION_TOKENS,
                label="Max Output Tokens",
            ),
            StringListInvocationParameter(
                invocation_name="stop_sequences",
                canonical_name=CanonicalParameterName.STOP_SEQUENCES,
                label="Stop Sequences",
            ),
            FloatInvocationParameter(
                invocation_name="presence_penalty",
                label="Presence Penalty",
                default_value=0.0,
            ),
            FloatInvocationParameter(
                invocation_name="frequency_penalty",
                label="Frequency Penalty",
                default_value=0.0,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="top_p",
                canonical_name=CanonicalParameterName.TOP_P,
                label="Top P",
                min_value=0.0,
                max_value=1.0,
            ),
            IntInvocationParameter(
                invocation_name="top_k",
                label="Top K",
            ),
            JSONInvocationParameter(
                invocation_name="tool_config",
                label="Tool Config",
                canonical_name=CanonicalParameterName.TOOL_CHOICE,
            ),
        ]

    async def chat_completion_create(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
        tools: list[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        from google.genai import types

        contents, system_prompt = self._build_google_messages(messages)

        config_dict = invocation_parameters.copy()

        if system_prompt:
            config_dict["system_instruction"] = system_prompt

        if tools:
            function_declarations = [types.FunctionDeclaration(**tool) for tool in tools]
            config_dict["tools"] = [types.Tool(function_declarations=function_declarations)]

        config = types.GenerateContentConfig.model_validate(config_dict)
        stream = await self.client.aio.models.generate_content_stream(
            model=f"models/{self.model_name}",
            contents=contents,
            config=config,
        )
        async for event in stream:
            self._attributes.update(
                {
                    LLM_TOKEN_COUNT_PROMPT: event.usage_metadata.prompt_token_count,
                    LLM_TOKEN_COUNT_COMPLETION: event.usage_metadata.candidates_token_count,
                    LLM_TOKEN_COUNT_TOTAL: event.usage_metadata.total_token_count,
                }
            )

            if event.candidates:
                candidate = event.candidates[0]
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if function_call := part.function_call:
                            yield ToolCallChunk(
                                id=function_call.id or "",
                                function=FunctionCallChunk(
                                    name=function_call.name or "",
                                    arguments=json.dumps(function_call.args or {}),
                                ),
                            )
                        elif text := part.text:
                            yield TextChunk(content=text)

    def _build_google_messages(
        self,
        messages: list[tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]]],
    ) -> tuple[list["ContentType"], str]:
        """Build Google messages following the standard pattern - process ALL messages."""
        google_messages: list["ContentType"] = []
        system_prompts = []
        for role, content, _tool_call_id, _tool_calls in messages:
            if role == ChatCompletionMessageRole.USER:
                google_messages.append({"role": "user", "parts": [{"text": content}]})
            elif role == ChatCompletionMessageRole.AI:
                google_messages.append({"role": "model", "parts": [{"text": content}]})
            elif role == ChatCompletionMessageRole.SYSTEM:
                system_prompts.append(content)
            elif role == ChatCompletionMessageRole.TOOL:
                raise NotImplementedError
            else:
                assert_never(role)

        return google_messages, "\n".join(system_prompts)


@register_llm_client(
    provider_key=GenerativeProviderKey.GOOGLE,
    model_names=[
        PROVIDER_DEFAULT,
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.5-pro-preview-03-25",
    ],
)
class Gemini25GoogleStreamingClient(GoogleStreamingClient):
    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        return [
            BoundedFloatInvocationParameter(
                invocation_name="temperature",
                canonical_name=CanonicalParameterName.TEMPERATURE,
                label="Temperature",
                default_value=1.0,
                min_value=0.0,
                max_value=2.0,
            ),
            IntInvocationParameter(
                invocation_name="max_output_tokens",
                canonical_name=CanonicalParameterName.MAX_COMPLETION_TOKENS,
                label="Max Output Tokens",
            ),
            StringListInvocationParameter(
                invocation_name="stop_sequences",
                canonical_name=CanonicalParameterName.STOP_SEQUENCES,
                label="Stop Sequences",
            ),
            BoundedFloatInvocationParameter(
                invocation_name="top_p",
                canonical_name=CanonicalParameterName.TOP_P,
                label="Top P",
                min_value=0.0,
                max_value=1.0,
            ),
            FloatInvocationParameter(
                invocation_name="top_k",
                label="Top K",
            ),
            JSONInvocationParameter(
                invocation_name="tool_config",
                label="Tool Choice",
                canonical_name=CanonicalParameterName.TOOL_CHOICE,
            ),
        ]


@register_llm_client(
    provider_key=GenerativeProviderKey.GOOGLE,
    model_names=[
        "gemini-3-pro-preview",
    ],
)
class Gemini3GoogleStreamingClient(Gemini25GoogleStreamingClient):
    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        return [
            StringInvocationParameter(
                invocation_name="thinking_level",
                label="Thinking Level",
                canonical_name=CanonicalParameterName.REASONING_EFFORT,
            ),
            *super().supported_invocation_parameters(),
        ]

    async def chat_completion_create(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
        tools: list[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        # Extract thinking_level and construct thinking_config
        thinking_level = invocation_parameters.pop("thinking_level", None)

        if thinking_level:
            try:
                import google.genai
                from packaging.version import parse as parse_version

                if parse_version(google.genai.__version__) < parse_version("1.50.0"):
                    raise ImportError
            except (ImportError, AttributeError):
                raise BadRequest(
                    "Reasoning capabilities for Gemini models require `google-genai>=1.50.0` "
                    "and Python >= 3.10."
                )

            # NOTE: as of gemini 1.51.0 medium thinking is not supported
            # but will eventually be added in a future version
            # we are purposefully allowing users to select medium knowing
            # it does not work.
            invocation_parameters["thinking_config"] = {
                "include_thoughts": True,
                "thinking_level": thinking_level.upper(),
            }

        async for chunk in super().chat_completion_create(messages, tools, **invocation_parameters):
            yield chunk


def initialize_playground_clients() -> None:
    """
    Ensure that all playground clients are registered at import time.
    """
    pass


LLM_PROVIDER = SpanAttributes.LLM_PROVIDER
LLM_SYSTEM = SpanAttributes.LLM_SYSTEM
LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
LLM_TOKEN_COUNT_TOTAL = SpanAttributes.LLM_TOKEN_COUNT_TOTAL
LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ = SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ
LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE = (
    SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE
)
LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO = SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO
LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING = (
    SpanAttributes.LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING
)
LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO


class _HttpxClient(wrapt.ObjectProxy):  # type: ignore
    def __init__(self, wrapped: httpx.AsyncClient, attributes: MutableMapping[str, Any]):
        super().__init__(wrapped)
        self._self_attributes = attributes

    async def send(self, request: httpx.Request, **kwargs: Any) -> Any:
        self._self_attributes["url.full"] = str(request.url)
        self._self_attributes["url.path"] = request.url.path.removeprefix(self.base_url.path)
        response = await self.__wrapped__.send(request, **kwargs)
        return response


async def get_playground_client(
    model: GenerativeModelInput,
    db: DbSessionFactory,
    decrypt: Callable[[bytes], bytes],
) -> "PlaygroundStreamingClient":
    """
    Create a playground streaming client for the given model configuration.

    Resolves credentials from multiple sources in priority order:
    1. Explicitly provided credentials in the input
    2. Encrypted secrets stored in the database
    3. Environment variables

    Args:
        model: The model configuration specifying either a builtin or custom provider.
        db: Database session factory for loading secrets and custom provider configs.
        decrypt: Function to decrypt encrypted values from the database.

    Returns:
        A configured PlaygroundStreamingClient ready for chat completions.

    Raises:
        BadRequest: If required credentials are missing or invalid.
        NotFound: If a custom provider ID doesn't exist.
    """
    if builtin := model.builtin:
        return await _get_builtin_provider_client(builtin, db, decrypt)
    if custom := model.custom:
        return await _get_custom_provider_client(custom, db, decrypt)
    raise BadRequest("Model input must specify either a builtin or custom provider")


async def _resolve_secrets(
    db: DbSessionFactory,
    decrypt: Callable[[bytes], bytes],
    *keys: str,
) -> dict[str, str]:
    """
    Resolve secrets from the database.

    Args:
        db: Database session factory.
        decrypt: Decryption function.
        *keys: Secret keys to look up.

    Returns:
        Dictionary mapping key names to their decrypted values.
        Keys not found in the database are omitted.

    Raises:
        BadRequest: If a secret exists but cannot be decrypted.
    """
    async with db() as session:
        secrets = (
            await session.scalars(sa.select(models.Secret).where(models.Secret.key.in_(keys)))
        ).all()
    result: dict[str, str] = {}
    for secret in secrets:
        try:
            result[secret.key] = decrypt(secret.value).decode("utf-8")
        except Exception:
            raise BadRequest(f"Failed to decrypt secret: {secret.key}")
    return result


def _get_credential_from_input(
    credentials: Sequence[GenerativeCredentialInput] | None,
    env_var_name: str,
) -> str | None:
    """Extract a credential value from the input credentials list."""
    if not credentials:
        return None
    return next(
        (c.value for c in credentials if c.env_var_name == env_var_name),
        None,
    )


async def _get_builtin_provider_client(
    obj: GenerativeModelBuiltinProviderInput,
    db: DbSessionFactory,
    decrypt: Callable[[bytes], bytes],
) -> "PlaygroundStreamingClient":
    """
    Create a playground client from a builtin provider configuration.

    Credentials are resolved in priority order:
    1. Explicitly provided in obj.credentials
    2. Encrypted secrets in the database
    3. Environment variables
    """
    headers = dict(obj.custom_headers) if obj.custom_headers else None
    provider_key = obj.provider_key
    model_name = obj.name
    provider = GENERATIVE_PROVIDER_KEY_TO_PROVIDER_STRING[provider_key]

    if provider_key == GenerativeProviderKey.OPENAI:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        api_key = (
            _get_credential_from_input(obj.credentials, "OPENAI_API_KEY")
            or (await _resolve_secrets(db, decrypt, "OPENAI_API_KEY")).get("OPENAI_API_KEY")
            or getenv("OPENAI_API_KEY")
        )
        base_url = obj.base_url or getenv("OPENAI_BASE_URL")

        if not api_key:
            if not base_url:
                raise BadRequest("An API key is required for OpenAI models")
            api_key = "sk-placeholder"  # Some OpenAI-compatible APIs don't need a key

        openai_client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            default_headers=headers,
            timeout=30,
        )
        if model_name in OPENAI_REASONING_MODELS:
            return OpenAIReasoningNonStreamingClient(
                client=openai_client,
                model_name=model_name,
                provider=provider,
            )
        return OpenAIStreamingClient(
            client=openai_client,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.AZURE_OPENAI:
        try:
            from openai import AsyncAzureOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        api_key = (
            _get_credential_from_input(obj.credentials, "AZURE_OPENAI_API_KEY")
            or (await _resolve_secrets(db, decrypt, "AZURE_OPENAI_API_KEY")).get(
                "AZURE_OPENAI_API_KEY"
            )
            or getenv("AZURE_OPENAI_API_KEY")
        )
        endpoint = obj.endpoint or getenv("AZURE_OPENAI_ENDPOINT")
        api_version = obj.api_version or getenv("OPENAI_API_VERSION")

        if not endpoint:
            raise BadRequest("An Azure endpoint is required for Azure OpenAI models")
        if not api_version:
            raise BadRequest("An API version is required for Azure OpenAI models")

        if api_key:
            azure_client = AsyncAzureOpenAI(
                api_key=api_key,
                azure_endpoint=endpoint,
                api_version=api_version,
                default_headers=headers,
            )
        else:
            try:
                from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider
            except ImportError:
                raise BadRequest(
                    "Provide an API key for Azure OpenAI models or install azure-identity"
                )
            azure_client = AsyncAzureOpenAI(
                azure_ad_token_provider=get_bearer_token_provider(
                    DefaultAzureCredential(),
                    "https://cognitiveservices.azure.com/.default",
                ),
                azure_endpoint=endpoint,
                api_version=api_version,
                default_headers=headers,
            )
        if model_name in OPENAI_REASONING_MODELS:
            return AzureOpenAIReasoningNonStreamingClient(
                client=azure_client,
                model_name=model_name,
                provider=provider,
            )
        return AzureOpenAIStreamingClient(
            client=azure_client,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.ANTHROPIC:
        try:
            import anthropic
        except ImportError:
            raise BadRequest("Anthropic package not installed. Run: pip install anthropic")

        api_key = (
            _get_credential_from_input(obj.credentials, "ANTHROPIC_API_KEY")
            or (await _resolve_secrets(db, decrypt, "ANTHROPIC_API_KEY")).get("ANTHROPIC_API_KEY")
            or getenv("ANTHROPIC_API_KEY")
        )
        if not api_key:
            raise BadRequest("An API key is required for Anthropic models")

        anthropic_client = anthropic.AsyncAnthropic(api_key=api_key, default_headers=headers)
        if model_name in ANTHROPIC_REASONING_MODELS:
            return AnthropicReasoningStreamingClient(
                client=anthropic_client,
                model_name=model_name,
                provider=provider,
            )
        return AnthropicStreamingClient(
            client=anthropic_client,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.GOOGLE:
        try:
            from google.genai.client import Client as GoogleGenAIClient
        except ImportError:
            raise BadRequest("Google GenAI package not installed. Run: pip install google-genai")

        # Try input credentials first
        api_key = _get_credential_from_input(
            obj.credentials, "GEMINI_API_KEY"
        ) or _get_credential_from_input(obj.credentials, "GOOGLE_API_KEY")

        # Fall back to database secrets
        if not api_key:
            secrets = await _resolve_secrets(db, decrypt, "GEMINI_API_KEY", "GOOGLE_API_KEY")
            api_key = secrets.get("GEMINI_API_KEY") or secrets.get("GOOGLE_API_KEY")

        # Fall back to environment variables
        if not api_key:
            api_key = getenv("GEMINI_API_KEY") or getenv("GOOGLE_API_KEY")

        if not api_key:
            raise BadRequest("An API key is required for Google GenAI models")

        google_client = GoogleGenAIClient(api_key=api_key)
        return GoogleStreamingClient(
            client=google_client,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.AWS:
        try:
            import boto3  # type: ignore[import-untyped]
        except ImportError:
            raise BadRequest("boto3 package not installed. Run: pip install boto3")

        region = obj.region or getenv("AWS_REGION") or "us-east-1"

        # Collect credentials from input
        aws_access_key_id = _get_credential_from_input(obj.credentials, "AWS_ACCESS_KEY_ID")
        aws_secret_access_key = _get_credential_from_input(obj.credentials, "AWS_SECRET_ACCESS_KEY")
        aws_session_token = _get_credential_from_input(obj.credentials, "AWS_SESSION_TOKEN")

        # Fall back to database secrets for missing credentials
        if not aws_access_key_id or not aws_secret_access_key:
            secrets = await _resolve_secrets(
                db, decrypt, "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"
            )
            aws_access_key_id = aws_access_key_id or secrets.get("AWS_ACCESS_KEY_ID")
            aws_secret_access_key = aws_secret_access_key or secrets.get("AWS_SECRET_ACCESS_KEY")
            aws_session_token = aws_session_token or secrets.get("AWS_SESSION_TOKEN")

        # Fall back to environment variables
        aws_access_key_id = aws_access_key_id or getenv("AWS_ACCESS_KEY_ID")
        aws_secret_access_key = aws_secret_access_key or getenv("AWS_SECRET_ACCESS_KEY")
        aws_session_token = aws_session_token or getenv("AWS_SESSION_TOKEN")

        session = boto3.Session(
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            aws_session_token=aws_session_token,
            region_name=region,
        )

        bedrock_client = session.client(service_name="bedrock-runtime")
        return BedrockStreamingClient(
            client=bedrock_client,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.DEEPSEEK:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        api_key = (
            _get_credential_from_input(obj.credentials, "DEEPSEEK_API_KEY")
            or (await _resolve_secrets(db, decrypt, "DEEPSEEK_API_KEY")).get("DEEPSEEK_API_KEY")
            or getenv("DEEPSEEK_API_KEY")
        )
        base_url = obj.base_url or getenv("DEEPSEEK_BASE_URL") or "https://api.deepseek.com"

        if not api_key:
            if base_url == "https://api.deepseek.com":
                raise BadRequest("An API key is required for DeepSeek models")
            api_key = "sk-placeholder"  # Custom endpoints may not need a key
        deepseek_client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            default_headers=headers,
        )
        return OpenAIStreamingClient(
            client=deepseek_client,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.XAI:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        api_key = (
            _get_credential_from_input(obj.credentials, "XAI_API_KEY")
            or (await _resolve_secrets(db, decrypt, "XAI_API_KEY")).get("XAI_API_KEY")
            or getenv("XAI_API_KEY")
        )
        base_url = obj.base_url or getenv("XAI_BASE_URL") or "https://api.x.ai/v1"

        if not api_key:
            if base_url == "https://api.x.ai/v1":
                raise BadRequest("An API key is required for xAI models")
            api_key = "sk-placeholder"  # Custom endpoints may not need a key
        xai_client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            default_headers=headers,
        )
        return OpenAIStreamingClient(
            client=xai_client,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.OLLAMA:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        base_url = obj.base_url or getenv("OLLAMA_BASE_URL")
        if not base_url:
            raise BadRequest("A base URL is required for Ollama models")

        ollama_client = AsyncOpenAI(
            api_key="ollama",
            base_url=base_url,
            default_headers=headers,
        )
        return OpenAIStreamingClient(
            client=ollama_client,
            model_name=model_name,
            provider=provider,
        )

    else:
        assert_never(provider_key)


async def _get_custom_provider_client(
    obj: GenerativeModelCustomProviderInput,
    db: DbSessionFactory,
    decrypt: Callable[[bytes], bytes],
) -> "PlaygroundStreamingClient":
    """
    Create a playground client from a custom provider stored in the database.

    Loads the provider configuration, decrypts it, and creates the appropriate
    SDK client based on the provider type.

    Args:
        obj: Custom provider input containing provider ID and model details.
        db: Database session factory.
        decrypt: Decryption function for the stored config.

    Returns:
        A configured PlaygroundStreamingClient.

    Raises:
        NotFound: If the provider ID doesn't exist.
        BadRequest: If decryption or parsing fails, or client creation fails.
    """

    _, provider_id = from_global_id(obj.provider_id)

    async with db() as session:
        provider_record = await session.get(models.GenerativeModelCustomProvider, provider_id)
        if not provider_record:
            raise NotFound(f"Custom provider with ID {provider_id} not found")

    try:
        decrypted_data = decrypt(provider_record.config)
    except Exception:
        raise BadRequest("Failed to decrypt custom provider config")

    try:
        config = GenerativeModelCustomerProviderConfig.model_validate_json(decrypted_data)
    except ValidationError:
        raise BadRequest("Failed to parse custom provider config")

    model_name = obj.model_name
    provider = obj.provider
    headers = dict(obj.extra_headers) if obj.extra_headers else None
    cfg = config.root
    if cfg.type == "openai":
        try:
            openai_client = cfg.get_client(extra_headers=headers)
        except Exception as e:
            raise BadRequest(f"Failed to create {cfg.type} client: {e}")
        if model_name in OPENAI_REASONING_MODELS:
            return OpenAIReasoningNonStreamingClient(
                client=openai_client,
                model_name=model_name,
                provider=provider,
            )
        return OpenAIStreamingClient(
            client=openai_client,
            model_name=model_name,
            provider=provider,
        )
    elif cfg.type == "azure_openai":
        try:
            azure_openai_client = cfg.get_client(extra_headers=headers)
        except Exception as e:
            raise BadRequest(f"Failed to create {cfg.type} client: {e}")
        model_name = model_name or cfg.azure_openai_client_kwargs.azure_deployment
        if model_name in OPENAI_REASONING_MODELS:
            return AzureOpenAIReasoningNonStreamingClient(
                client=azure_openai_client,
                model_name=model_name,
                provider=provider,
            )
        return AzureOpenAIStreamingClient(
            client=azure_openai_client,
            model_name=model_name,
            provider=provider,
        )
    elif cfg.type == "anthropic":
        try:
            anthropic_client = cfg.get_client(extra_headers=headers)
        except Exception as e:
            raise BadRequest(f"Failed to create {cfg.type} client: {e}")
        if model_name in ANTHROPIC_REASONING_MODELS:
            return AnthropicReasoningStreamingClient(
                client=anthropic_client, model_name=model_name, provider=provider
            )
        return AnthropicStreamingClient(
            client=anthropic_client,
            model_name=model_name,
            provider=provider,
        )
    elif cfg.type == "aws_bedrock":
        try:
            aws_bedrock_client = cfg.get_client(extra_headers=headers)
        except Exception as e:
            raise BadRequest(f"Failed to create {cfg.type} client: {e}")
        return BedrockStreamingClient(
            client=aws_bedrock_client,
            model_name=model_name,
            provider=provider,
        )
    elif cfg.type == "google_genai":
        try:
            google_genai_client = cfg.get_client(extra_headers=headers)
        except Exception as e:
            raise BadRequest(f"Failed to create {cfg.type} client: {e}")
        return GoogleStreamingClient(
            client=google_genai_client,
            model_name=model_name,
            provider=provider,
        )
    else:
        assert_never(cfg)
