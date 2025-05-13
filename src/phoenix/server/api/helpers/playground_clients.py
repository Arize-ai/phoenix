from __future__ import annotations

import asyncio
import importlib.util
import inspect
import json
import time
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Callable, Iterator
from functools import wraps
from typing import TYPE_CHECKING, Any, Hashable, Mapping, MutableMapping, Optional, Union

import wrapt
from openinference.instrumentation import safe_json_dumps
from openinference.semconv.trace import (
    OpenInferenceLLMProviderValues,
    OpenInferenceLLMSystemValues,
    SpanAttributes,
)
from strawberry import UNSET
from strawberry.scalars import JSON as JSONScalarType
from typing_extensions import TypeAlias, assert_never

from phoenix.config import getenv
from phoenix.evals.models.rate_limiters import (
    AsyncCallable,
    GenericType,
    ParameterSpec,
    RateLimiter,
    RateLimitError,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.playground_registry import PROVIDER_DEFAULT, register_llm_client
from phoenix.server.api.input_types.GenerativeModelInput import GenerativeModelInput
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
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey

if TYPE_CHECKING:
    import httpx
    from anthropic.types import MessageParam, TextBlockParam, ToolResultBlockParam
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
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
    ) -> None:
        self._attributes: dict[str, AttributeValue] = dict()

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
    def __init__(
        self,
        *,
        client: Union["AsyncOpenAI", "AsyncAzureOpenAI"],
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
    ) -> None:
        from openai import RateLimitError as OpenAIRateLimitError

        super().__init__(model=model, api_key=api_key)
        self.client = client
        self.model_name = model.name
        self.rate_limiter = PlaygroundRateLimiter(model.provider_key, OpenAIRateLimitError)
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
                default_value=1.0,
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
                continue
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
    def __init__(
        self,
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
    ) -> None:
        from openai import AsyncOpenAI

        base_url = model.base_url or getenv("OPENAI_BASE_URL")
        if not (api_key := api_key or getenv("OPENAI_API_KEY")):
            if not base_url:
                raise BadRequest("An API key is required for OpenAI models")
            api_key = "sk-fake-api-key"
        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        super().__init__(client=client, model=model, api_key=api_key)
        self._attributes[LLM_PROVIDER] = OpenInferenceLLMProviderValues.OPENAI.value
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.OPENAI.value


@register_llm_client(
    provider_key=GenerativeProviderKey.OPENAI,
    model_names=[
        "o1",
        "o1-2024-12-17",
        "o1-mini",
        "o1-mini-2024-09-12",
        "o1-preview",
        "o1-preview-2024-09-12",
        "o3-mini",
        "o3-mini-2025-01-31",
    ],
)
class OpenAIReasoningStreamingClient(OpenAIStreamingClient):
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

    @staticmethod
    def _llm_token_counts(usage: "CompletionUsage") -> Iterator[tuple[str, Any]]:
        yield LLM_TOKEN_COUNT_PROMPT, usage.prompt_tokens
        yield LLM_TOKEN_COUNT_COMPLETION, usage.completion_tokens
        yield LLM_TOKEN_COUNT_TOTAL, usage.total_tokens


@register_llm_client(
    provider_key=GenerativeProviderKey.AZURE_OPENAI,
    model_names=[
        PROVIDER_DEFAULT,
    ],
)
class AzureOpenAIStreamingClient(OpenAIBaseStreamingClient):
    def __init__(
        self,
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
    ):
        from openai import AsyncAzureOpenAI

        if not (endpoint := model.endpoint or getenv("AZURE_OPENAI_ENDPOINT")):
            raise BadRequest("An Azure endpoint is required for Azure OpenAI models")
        if not (api_version := model.api_version or getenv("OPENAI_API_VERSION")):
            raise BadRequest("An OpenAI API version is required for Azure OpenAI models")
        if api_key := api_key or getenv("AZURE_OPENAI_API_KEY"):
            client = AsyncAzureOpenAI(
                api_key=api_key,
                azure_endpoint=endpoint,
                api_version=api_version,
            )
        else:
            try:
                from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider
            except ImportError:
                raise BadRequest(
                    "Provide an API key for Azure OpenAI models or use azure-identity, see. e.g. "
                    "https://learn.microsoft.com/en-us/python/api/azure-identity/azure.identity.environmentcredential?view=azure-python"  # noqa: E501
                )

            client = AsyncAzureOpenAI(
                azure_ad_token_provider=get_bearer_token_provider(
                    DefaultAzureCredential(),
                    "https://cognitiveservices.azure.com/.default",
                ),
                azure_endpoint=endpoint,
                api_version=api_version,
            )
        super().__init__(client=client, model=model, api_key=api_key)
        self._attributes[LLM_PROVIDER] = OpenInferenceLLMProviderValues.AZURE.value
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.OPENAI.value


@register_llm_client(
    provider_key=GenerativeProviderKey.ANTHROPIC,
    model_names=[
        PROVIDER_DEFAULT,
        "claude-3-7-latest",
        "claude-3-7-sonnet-20250219",
        "claude-3-5-sonnet-latest",
        "claude-3-5-haiku-latest",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-5-sonnet-20240620",
        "claude-3-opus-latest",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
    ],
)
class AnthropicStreamingClient(PlaygroundStreamingClient):
    def __init__(
        self,
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
    ) -> None:
        import anthropic

        super().__init__(model=model, api_key=api_key)
        self._attributes[LLM_PROVIDER] = OpenInferenceLLMProviderValues.ANTHROPIC.value
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.ANTHROPIC.value
        if not (api_key := api_key or getenv("ANTHROPIC_API_KEY")):
            raise BadRequest("An API key is required for Anthropic models")
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model_name = model.name
        self.rate_limiter = PlaygroundRateLimiter(model.provider_key, anthropic.RateLimitError)
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
                default_value=1.0,
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
        import anthropic.lib.streaming as anthropic_streaming
        import anthropic.types as anthropic_types

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
                if isinstance(event, anthropic_types.RawMessageStartEvent):
                    self._attributes.update(
                        {LLM_TOKEN_COUNT_PROMPT: event.message.usage.input_tokens}
                    )
                elif isinstance(event, anthropic_streaming.TextEvent):
                    yield TextChunk(content=event.text)
                elif isinstance(event, anthropic_streaming.MessageStopEvent):
                    self._attributes.update(
                        {LLM_TOKEN_COUNT_COMPLETION: event.message.usage.output_tokens}
                    )
                elif (
                    isinstance(event, anthropic_streaming.ContentBlockStopEvent)
                    and event.content_block.type == "tool_use"
                ):
                    tool_call_chunk = ToolCallChunk(
                        id=event.content_block.id,
                        function=FunctionCallChunk(
                            name=event.content_block.name,
                            arguments=json.dumps(event.content_block.input),
                        ),
                    )
                    yield tool_call_chunk
                elif isinstance(
                    event,
                    (
                        anthropic_types.RawContentBlockStartEvent,
                        anthropic_types.RawContentBlockDeltaEvent,
                        anthropic_types.RawMessageDeltaEvent,
                        anthropic_streaming.ContentBlockStopEvent,
                        anthropic_streaming.InputJsonEvent,
                    ),
                ):
                    # event types emitted by the stream that don't contain useful information
                    pass
                elif isinstance(event, anthropic_streaming.InputJsonEvent):
                    raise NotImplementedError
                elif isinstance(event, anthropic_streaming._types.CitationEvent):
                    raise NotImplementedError
                elif isinstance(event, anthropic_streaming._types.ThinkingEvent):
                    pass
                elif isinstance(event, anthropic_streaming._types.SignatureEvent):
                    pass
                else:
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


@register_llm_client(
    provider_key=GenerativeProviderKey.ANTHROPIC,
    model_names=[
        "claude-3-7-sonnet-latest",
        "claude-3-7-sonnet-20250219",
    ],
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
        "gemini-2.5-pro-preview-03-25",
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
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
    ) -> None:
        import google.generativeai as google_genai

        super().__init__(model=model, api_key=api_key)
        self._attributes[LLM_PROVIDER] = OpenInferenceLLMProviderValues.GOOGLE.value
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.VERTEXAI.value
        if not (api_key := api_key or getenv("GEMINI_API_KEY") or getenv("GOOGLE_API_KEY")):
            raise BadRequest("An API key is required for Gemini models")
        google_genai.configure(api_key=api_key)
        self.model_name = model.name

    @classmethod
    def dependencies(cls) -> list[Dependency]:
        return [Dependency(name="google-generativeai", module_name="google.generativeai")]

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
                default_value=1.0,
                min_value=0.0,
                max_value=1.0,
            ),
            IntInvocationParameter(
                invocation_name="top_k",
                label="Top K",
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
        import google.generativeai as google_genai

        google_message_history, current_message, system_prompt = self._build_google_messages(
            messages
        )

        model_args = {"model_name": self.model_name}
        if system_prompt:
            model_args["system_instruction"] = system_prompt
        client = google_genai.GenerativeModel(**model_args)

        google_config = google_genai.GenerationConfig(
            **invocation_parameters,
        )
        google_params = {
            "content": current_message,
            "generation_config": google_config,
            "stream": True,
        }

        chat = client.start_chat(history=google_message_history)
        stream = await chat.send_message_async(**google_params)
        async for event in stream:
            self._attributes.update(
                {
                    LLM_TOKEN_COUNT_PROMPT: event.usage_metadata.prompt_token_count,
                    LLM_TOKEN_COUNT_COMPLETION: event.usage_metadata.candidates_token_count,
                    LLM_TOKEN_COUNT_TOTAL: event.usage_metadata.total_token_count,
                }
            )
            yield TextChunk(content=event.text)

    def _build_google_messages(
        self,
        messages: list[tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]]],
    ) -> tuple[list["ContentType"], str, str]:
        google_message_history: list["ContentType"] = []
        system_prompts = []
        for role, content, _tool_call_id, _tool_calls in messages:
            if role == ChatCompletionMessageRole.USER:
                google_message_history.append({"role": "user", "parts": content})
            elif role == ChatCompletionMessageRole.AI:
                google_message_history.append({"role": "model", "parts": content})
            elif role == ChatCompletionMessageRole.SYSTEM:
                system_prompts.append(content)
            elif role == ChatCompletionMessageRole.TOOL:
                raise NotImplementedError
            else:
                assert_never(role)
        if google_message_history:
            prompt = google_message_history.pop()["parts"]
        else:
            prompt = ""

        return google_message_history, prompt, "\n".join(system_prompts)


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


class _HttpxClient(wrapt.ObjectProxy):  # type: ignore
    def __init__(self, wrapped: httpx.AsyncClient, attributes: MutableMapping[str, Any]):
        super().__init__(wrapped)
        self._self_attributes = attributes

    async def send(self, request: httpx.Request, **kwargs: Any) -> Any:
        self._self_attributes["url.full"] = str(request.url)
        self._self_attributes["url.path"] = request.url.path.removeprefix(self.base_url.path)
        response = await self.__wrapped__.send(request, **kwargs)
        return response
