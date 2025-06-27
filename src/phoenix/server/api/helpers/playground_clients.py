from __future__ import annotations

import asyncio
import importlib.util
import inspect
import json
import time
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Callable, Iterator
from dataclasses import dataclass
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


@dataclass
class PlaygroundClientCredential:
    """
    Represents a credential for LLM providers.
    """

    env_var_name: str
    value: str


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
        credentials: Optional[list[PlaygroundClientCredential]] = None,
    ) -> None:
        self._attributes: dict[str, AttributeValue] = dict()
        self._credentials = credentials or []

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
        credentials: Optional[list[PlaygroundClientCredential]] = None,
    ) -> None:
        from openai import RateLimitError as OpenAIRateLimitError

        super().__init__(model=model, credentials=credentials)
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


def _get_credential_value(
    credentials: Optional[list[PlaygroundClientCredential]], env_var_name: str
) -> Optional[str]:
    """Helper function to extract credential value from credentials list."""
    if not credentials:
        return None
    return next(
        (credential.value for credential in credentials if credential.env_var_name == env_var_name),
        None,
    )


def _require_credential(
    credentials: Optional[list[PlaygroundClientCredential]], env_var_name: str, provider_name: str
) -> str:
    """Helper function to require a credential value, raising an exception if not found."""
    value = _get_credential_value(credentials, env_var_name)
    if value is None:
        raise BadRequest(f"Missing required credential '{env_var_name}' for {provider_name}")
    return value


@register_llm_client(
    provider_key=GenerativeProviderKey.DEEPSEEK,
    model_names=[
        PROVIDER_DEFAULT,
        "deepseek-chat",
        "deepseek-reasoner",
    ],
)
class DeepSeekStreamingClient(OpenAIBaseStreamingClient):
    def __init__(
        self,
        model: GenerativeModelInput,
        credentials: Optional[list[PlaygroundClientCredential]] = None,
    ) -> None:
        from openai import AsyncOpenAI

        base_url = model.base_url or getenv("DEEPSEEK_BASE_URL")

        # Try to get API key from credentials first, then fallback to env
        api_key = _get_credential_value(credentials, "DEEPSEEK_API_KEY") or getenv(
            "DEEPSEEK_API_KEY"
        )

        if not api_key:
            if not base_url:
                raise BadRequest("An API key is required for DeepSeek models")
            api_key = "sk-fake-api-key"

        client = AsyncOpenAI(api_key=api_key, base_url=base_url or "https://api.deepseek.com")
        super().__init__(client=client, model=model, credentials=credentials)
        # DeepSeek uses OpenAI-compatible API but we'll track it as a separate provider
        # Adding a custom "deepseek" provider value to make it distinguishable in traces
        self._attributes[LLM_PROVIDER] = "deepseek"
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.OPENAI.value


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
    def __init__(
        self,
        model: GenerativeModelInput,
        credentials: Optional[list[PlaygroundClientCredential]] = None,
    ) -> None:
        from openai import AsyncOpenAI

        base_url = model.base_url or getenv("XAI_BASE_URL")

        # Try to get API key from credentials first, then fallback to env
        api_key = _get_credential_value(credentials, "XAI_API_KEY") or getenv("XAI_API_KEY")

        if not api_key:
            if not base_url:
                raise BadRequest("An API key is required for xAI models")
            api_key = "sk-fake-api-key"

        client = AsyncOpenAI(api_key=api_key, base_url=base_url or "https://api.x.ai/v1")
        super().__init__(client=client, model=model, credentials=credentials)
        # xAI uses OpenAI-compatible API but we'll track it as a separate provider
        # Adding a custom "xai" provider value to make it distinguishable in traces
        self._attributes[LLM_PROVIDER] = "xai"
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.OPENAI.value


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
    def __init__(
        self,
        model: GenerativeModelInput,
        credentials: Optional[list[PlaygroundClientCredential]] = None,
    ) -> None:
        from openai import AsyncOpenAI

        base_url = model.base_url or getenv("OLLAMA_BASE_URL")
        if not base_url:
            raise BadRequest("An Ollama base URL is required for Ollama models")
        api_key = "ollama"
        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        super().__init__(client=client, model=model, credentials=credentials)
        # Ollama uses OpenAI-compatible API but we'll track it as a separate provider
        # Adding a custom "ollama" provider value to make it distinguishable in traces
        self._attributes[LLM_PROVIDER] = "ollama"
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.OPENAI.value


@register_llm_client(
    provider_key=GenerativeProviderKey.AWS,
    model_names=[
        PROVIDER_DEFAULT,
        "anthropic.claude-3-5-sonnet-20240620-v1:0",
        "anthropic.claude-3-7-sonnet-20250219-v1:0",
        "anthropic.claude-3-haiku-20240307-v1:0",
        "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "anthropic.claude-3-5-haiku-20241022-v1:0",
        "anthropic.claude-opus-4-20250514-v1:0",
        "anthropic.claude-sonnet-4-20250514-v1:0",
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
        model: GenerativeModelInput,
        credentials: Optional[list[PlaygroundClientCredential]] = None,
    ) -> None:
        import boto3  # type: ignore[import-untyped]

        super().__init__(model=model, credentials=credentials)
        self.region = model.region or "us-east-1"
        self.api = "converse"
        self.aws_access_key_id = _get_credential_value(credentials, "AWS_ACCESS_KEY_ID") or getenv(
            "AWS_ACCESS_KEY_ID"
        )
        self.aws_secret_access_key = _get_credential_value(
            credentials, "AWS_SECRET_ACCESS_KEY"
        ) or getenv("AWS_SECRET_ACCESS_KEY")
        self.aws_session_token = _get_credential_value(credentials, "AWS_SESSION_TOKEN") or getenv(
            "AWS_SESSION_TOKEN"
        )
        self.model_name = model.name
        self.client = boto3.client(
            service_name="bedrock-runtime",
            region_name="us-east-1",  # match the default region in the UI
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key,
            aws_session_token=self.aws_session_token,
        )

        self._attributes[LLM_PROVIDER] = "aws"
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
        import boto3

        if (
            self.client.meta.region_name != self.region
        ):  # override the region if it's different from the default
            self.client = boto3.client(
                "bedrock-runtime",
                region_name=self.region,
                aws_access_key_id=self.aws_access_key_id,
                aws_secret_access_key=self.aws_secret_access_key,
                aws_session_token=self.aws_session_token,
            )
        if self.api == "invoke":
            async for chunk in self._handle_invoke_api(messages, tools, invocation_parameters):
                yield chunk
        else:
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

        # Build the request parameters for Converse API
        converse_params: dict[str, Any] = {
            "modelId": f"us.{self.model_name}",
            "messages": converse_messages,
            "inferenceConfig": {
                "maxTokens": invocation_parameters["max_tokens"],
                "temperature": invocation_parameters["temperature"],
                "topP": invocation_parameters["top_p"],
            },
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
            "max_tokens": invocation_parameters["max_tokens"],
            "messages": bedrock_messages,
            "system": system_prompt,
            "temperature": invocation_parameters["temperature"],
            "top_p": invocation_parameters["top_p"],
            "tools": tools,
        }

        response = self.client.invoke_model_with_response_stream(
            modelId=f"us.{self.model_name}",  # or another Claude model
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
    def __init__(
        self,
        model: GenerativeModelInput,
        credentials: Optional[list[PlaygroundClientCredential]] = None,
    ) -> None:
        from openai import AsyncOpenAI

        base_url = model.base_url or getenv("OPENAI_BASE_URL")

        # Try to get API key from credentials first, then fallback to env
        api_key = _get_credential_value(credentials, "OPENAI_API_KEY") or getenv("OPENAI_API_KEY")

        if not api_key:
            if not base_url:
                raise BadRequest("An API key is required for OpenAI models")
            api_key = "sk-fake-api-key"

        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        super().__init__(client=client, model=model, credentials=credentials)
        self._attributes[LLM_PROVIDER] = OpenInferenceLLMProviderValues.OPENAI.value
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.OPENAI.value


@register_llm_client(
    provider_key=GenerativeProviderKey.OPENAI,
    model_names=[
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
    provider_key=GenerativeProviderKey.AZURE_OPENAI,
    model_names=[
        PROVIDER_DEFAULT,
    ],
)
class AzureOpenAIStreamingClient(OpenAIBaseStreamingClient):
    def __init__(
        self,
        model: GenerativeModelInput,
        credentials: Optional[list[PlaygroundClientCredential]] = None,
    ):
        from openai import AsyncAzureOpenAI

        if not (endpoint := model.endpoint or getenv("AZURE_OPENAI_ENDPOINT")):
            raise BadRequest("An Azure endpoint is required for Azure OpenAI models")
        if not (api_version := model.api_version or getenv("OPENAI_API_VERSION")):
            raise BadRequest("An OpenAI API version is required for Azure OpenAI models")

        # Try to get API key from credentials first, then fallback to env
        api_key = _get_credential_value(credentials, "AZURE_OPENAI_API_KEY") or getenv(
            "AZURE_OPENAI_API_KEY"
        )

        if api_key:
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
        super().__init__(client=client, model=model, credentials=credentials)
        self._attributes[LLM_PROVIDER] = OpenInferenceLLMProviderValues.AZURE.value
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.OPENAI.value


@register_llm_client(
    provider_key=GenerativeProviderKey.ANTHROPIC,
    model_names=[
        PROVIDER_DEFAULT,
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
        credentials: Optional[list[PlaygroundClientCredential]] = None,
    ) -> None:
        import anthropic

        super().__init__(model=model, credentials=credentials)
        self._attributes[LLM_PROVIDER] = OpenInferenceLLMProviderValues.ANTHROPIC.value
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.ANTHROPIC.value

        # Try to get API key from credentials first, then fallback to env
        api_key = _get_credential_value(credentials, "ANTHROPIC_API_KEY") or getenv(
            "ANTHROPIC_API_KEY"
        )

        if not api_key:
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
                elif isinstance(event, anthropic_streaming.TextEvent):
                    yield TextChunk(content=event.text)
                elif isinstance(event, anthropic_streaming.MessageStopEvent):
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
        "claude-sonnet-4-0",
        "claude-sonnet-4-20250514",
        "claude-opus-4-0",
        "claude-opus-4-20250514",
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
        credentials: Optional[list[PlaygroundClientCredential]] = None,
    ) -> None:
        import google.generativeai as google_genai

        super().__init__(model=model, credentials=credentials)
        self._attributes[LLM_PROVIDER] = OpenInferenceLLMProviderValues.GOOGLE.value
        self._attributes[LLM_SYSTEM] = OpenInferenceLLMSystemValues.VERTEXAI.value

        # Try to get API key from credentials first, then fallback to env
        api_key = (
            _get_credential_value(credentials, "GEMINI_API_KEY")
            or _get_credential_value(credentials, "GOOGLE_API_KEY")
            or getenv("GEMINI_API_KEY")
            or getenv("GOOGLE_API_KEY")
        )

        if not api_key:
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
