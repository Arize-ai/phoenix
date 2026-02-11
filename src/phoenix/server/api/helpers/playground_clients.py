from __future__ import annotations

import asyncio
import importlib.util
import inspect
import json
import time
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import AsyncIterator, Callable, Iterator
from contextlib import AbstractAsyncContextManager
from functools import wraps
from itertools import chain
from typing import (
    TYPE_CHECKING,
    Any,
    AsyncIterable,
    Generic,
    Hashable,
    Iterable,
    Mapping,
    Optional,
    Sequence,
    TypeVar,
    Union,
    cast,
)

import openinference.instrumentation as oi
import sqlalchemy as sa
import wrapt
from openinference.instrumentation import (
    get_input_attributes,
    get_llm_provider_attributes,
    get_llm_system_attributes,
    get_output_attributes,
    safe_json_dumps,
)
from openinference.instrumentation.openai._attributes._responses_api import (
    _ResponsesApiAttributes,
)
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
from opentelemetry.semconv.attributes.url_attributes import URL_FULL, URL_PATH
from opentelemetry.trace import NoOpTracer, Status, StatusCode, Tracer
from opentelemetry.trace import Span as OTelSpan
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry import UNSET
from strawberry.scalars import JSON as JSONScalarType
from typing_extensions import TypeAlias, assert_never, override

from phoenix.config import getenv
from phoenix.db import models
from phoenix.db.types.model_provider import (
    GenerativeModelCustomerProviderConfig,
)
from phoenix.evals.models.rate_limiters import (
    AsyncCallable,
    GenericType,
    ParameterSpec,
    RateLimiter,
    RateLimitError,
)
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.message_helpers import PlaygroundMessage, PlaygroundToolCall
from phoenix.server.api.helpers.playground_registry import PROVIDER_DEFAULT, register_llm_client
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.input_types.GenerativeModelInput import (
    GenerativeModelBuiltinProviderInput,
    GenerativeModelCustomProviderInput,
    GenerativeModelInput,
    OpenAIApiType,
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
from phoenix.utilities.json import jsonify

if TYPE_CHECKING:
    import httpx
    from anthropic import AsyncAnthropic
    from anthropic.types import MessageParam, TextBlockParam, ToolResultBlockParam
    from google.genai.client import AsyncClient as GoogleAsyncClient
    from google.generativeai.types import ContentType
    from openai import AsyncOpenAI, AsyncStream
    from openai.types import CompletionUsage
    from openai.types.chat import (
        ChatCompletionMessageParam,
        ChatCompletionMessageToolCallParam,
    )
    from openai.types.responses import (
        Response,
        ResponseInputItemParam,
        ResponseStreamEvent,
    )
    from types_aiobotocore_bedrock_runtime.client import BedrockRuntimeClient

# TypeVar for generic client type
ClientT = TypeVar("ClientT")

SetSpanAttributesFn: TypeAlias = Callable[[Mapping[str, Any]], None]
ChatCompletionChunk: TypeAlias = Union[TextChunk, ToolCallChunk]
ClientFactory: TypeAlias = Callable[[], AbstractAsyncContextManager[Any]]
ToolCallID: TypeAlias = str


def _tools_chat_completions_to_responses_api(
    tools: list[JSONScalarType],
) -> list[dict[str, Any]]:
    """
    Convert tools from Chat Completions format (name/description/parameters under
    a nested 'function' key) to Responses API format (flat type, name, description,
    parameters at top level). Leaves non-function tools and already-flat tools
    unchanged. Skips non-dict items.
    """
    result: list[dict[str, Any]] = []
    for tool in tools:
        if not isinstance(tool, dict):
            continue
        if "function" in tool:
            fn = tool["function"]
            if not isinstance(fn, dict):
                result.append(tool)
                continue
            flat: dict[str, Any] = {
                "type": tool.get("type", "function"),
                "name": fn.get("name", ""),
                "parameters": fn.get("parameters") if fn.get("parameters") is not None else {},
            }
            if "description" in fn:
                flat["description"] = fn["description"]
            if "strict" in fn:
                flat["strict"] = fn["strict"]
            result.append(flat)
        else:
            result.append(tool)
    return result


# Parameters accepted by OpenAI Responses API responses.create.
# Chat Completions uses different names; this mapping converts mixin params to Responses API.
_RESPONSES_API_PARAM_NAMES = frozenset(
    {
        "max_output_tokens",
        "reasoning",
        "temperature",
        "top_p",
        "tool_choice",
        "extra_body",
    }
)


def _invocation_parameters_to_responses_api(
    invocation_parameters: dict[str, Any],
) -> dict[str, Any]:
    """
    Map Chat Completions-style invocation parameters to OpenAI Responses API
    parameter names and shapes. responses.create() rejects unknown keyword
    arguments, so we only pass known params and map names where they differ.
    """
    out: dict[str, Any] = {}
    extra_body: dict[str, Any] = {}

    for key, value in invocation_parameters.items():
        if value is None:
            continue
        if key == "max_completion_tokens":
            out["max_output_tokens"] = value
        elif key == "reasoning_effort":
            out["reasoning"] = {"effort": value}
        elif key == "temperature":
            out["temperature"] = value
        elif key == "top_p":
            out["top_p"] = value
        elif key == "tool_choice":
            out["tool_choice"] = value
        elif key == "extra_body":
            if isinstance(value, dict):
                extra_body.update(value)
            else:
                extra_body["extra_body"] = value
        elif key in ("seed", "response_format"):
            extra_body[key] = value
        elif key in _RESPONSES_API_PARAM_NAMES:
            out[key] = value

    if extra_body:
        out["extra_body"] = extra_body
    return out


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


class PlaygroundStreamingClient(ABC, Generic[ClientT]):
    _client_factory: Callable[[], AbstractAsyncContextManager[ClientT]]

    def __init__(
        self,
        *,
        client_factory: Callable[[], AbstractAsyncContextManager[ClientT]],
        model_name: str,
        provider: str,
    ) -> None:
        self.provider = provider
        self.model_name = model_name
        self._client_factory = client_factory

    @property
    @abstractmethod
    def llm_system(self) -> str: ...

    @classmethod
    @abstractmethod
    def dependencies(cls) -> list[Dependency]:
        # A list of dependencies this client needs to run
        ...

    @classmethod
    @abstractmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]: ...

    @property
    def response_attributes_are_auto_accumulating(self) -> bool:
        """
        Whether the response attributes are automatically set from the full response.
        When True, the base class does not accumulate chunks for attributes or set
        output attributes from chunks (e.g. OpenAI Responses API sets them from
        the completed response).
        """
        return False

    async def chat_completion_create(
        self,
        messages: list[PlaygroundMessage],
        tools: list[JSONScalarType],
        tracer: Tracer | None = None,
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        tracer_ = tracer or NoOpTracer()
        attributes = dict(
            chain(
                llm_span_kind(),
                llm_model_name(self.model_name),
                get_llm_system_attributes(self.llm_system).items(),
                get_llm_provider_attributes(self.provider).items(),
                llm_tools(tools),
                llm_input_messages(messages),
                llm_invocation_parameters(invocation_parameters),
                get_input_attributes(
                    jsonify(
                        {
                            "messages": messages,
                            "tools": tools,
                            "invocation_parameters": _filter_invocation_parameters(
                                invocation_parameters
                            ),
                        }
                    )
                ).items(),
            )
        )

        with tracer_.start_as_current_span(
            "ChatCompletion",
            attributes=attributes,
            set_status_on_exception=False,  # manually set exception to control message
        ) as span:
            text_chunks: list[TextChunk] = []
            tool_call_chunks: defaultdict[ToolCallID, list[ToolCallChunk]] = defaultdict(list)
            auto_accumulating = self.response_attributes_are_auto_accumulating
            try:
                async for chunk in self._chat_completion_create(
                    messages=messages, tools=tools, span=span, **invocation_parameters
                ):
                    if isinstance(chunk, TextChunk):
                        if not auto_accumulating:
                            text_chunks.append(chunk)
                        yield chunk
                    elif isinstance(chunk, ToolCallChunk):
                        if not auto_accumulating:
                            tool_call_chunks[chunk.id].append(chunk)
                        yield chunk

                span.set_status(Status(StatusCode.OK))
                if not auto_accumulating and (text_chunks or tool_call_chunks):
                    span.set_attributes(dict(_llm_output_messages(text_chunks, tool_call_chunks)))
                    if output_attrs := _output_attributes(text_chunks, tool_call_chunks):
                        span.set_attributes(output_attrs)
            except Exception as e:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                # no need to manually record exception, otel will handle for us
                raise

    @abstractmethod
    def _chat_completion_create(
        self,
        *,
        messages: list[PlaygroundMessage],
        tools: list[JSONScalarType],
        span: OTelSpan,
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]: ...

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


class OpenAIBaseStreamingClient(PlaygroundStreamingClient["AsyncOpenAI"]):
    @property
    def llm_system(self) -> str:
        return OpenInferenceLLMSystemValues.OPENAI.value

    def __init__(
        self,
        *,
        client_factory: Callable[[], AbstractAsyncContextManager["AsyncOpenAI"]],
        model_name: str,
        provider: str,
    ) -> None:
        if not model_name:
            raise BadRequest("A model name is required for OpenAI models")
        from openai import RateLimitError as OpenAIRateLimitError

        super().__init__(
            client_factory=client_factory,
            provider=provider,
            model_name=model_name,
        )
        self.rate_limiter = PlaygroundRateLimiter(provider, OpenAIRateLimitError)

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
                min_value=0.0,
                max_value=2.0,
            ),
            IntInvocationParameter(
                invocation_name="max_completion_tokens",
                canonical_name=CanonicalParameterName.MAX_COMPLETION_TOKENS,
                label="Max Completion Tokens",
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

    async def _chat_completion_create(
        self,
        *,
        messages: list[PlaygroundMessage],
        tools: list[JSONScalarType],
        span: OTelSpan,
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        from openai import omit
        from openai.types import chat

        # Convert standard messages to OpenAI messages
        openai_messages = []
        for message in messages:
            openai_message = self.to_openai_chat_completion_param(message)
            if openai_message is not None:
                openai_messages.append(openai_message)
        tool_call_ids: dict[int, str] = {}
        token_usage: Optional["CompletionUsage"] = None

        async with self._client_factory() as client:
            # Wrap httpx client for instrumentation (fresh client each request)
            client._client = _HttpxClient(client._client, span=span)
            throttled_create = self.rate_limiter._alimit(client.chat.completions.create)
            stream = cast(
                AsyncIterable[chat.ChatCompletionChunk],
                await throttled_create(
                    messages=openai_messages,
                    model=self.model_name,
                    stream=True,
                    stream_options=chat.ChatCompletionStreamOptionsParam(include_usage=True),
                    tools=tools or omit,
                    **invocation_parameters,
                ),
            )
            async for chunk in stream:
                if (usage := chunk.usage) is not None:
                    token_usage = usage
                if not chunk.choices:
                    # for Azure, initial chunk contains the content filter
                    continue
                choice = chunk.choices[0]
                delta = choice.delta
                if choice.finish_reason is None:
                    if isinstance(chunk_content := delta.content, str):
                        yield TextChunk(content=chunk_content)
                    if (tool_calls := delta.tool_calls) is not None:
                        for tool_call_index, tool_call in enumerate(tool_calls):
                            tool_call_id = (
                                tool_call.id
                                if tool_call.id is not None
                                else tool_call_ids[tool_call_index]
                            )
                            tool_call_ids[tool_call_index] = tool_call_id
                            if (function := tool_call.function) is not None:
                                yield ToolCallChunk(
                                    id=tool_call_id,
                                    function=FunctionCallChunk(
                                        name=function.name or "",
                                        arguments=function.arguments or "",
                                    ),
                                )

            if token_usage is not None:
                span.set_attributes(dict(self._llm_token_counts(token_usage)))

    @staticmethod
    def _to_openai_response_input_item_param(
        messages: list[PlaygroundMessage],
    ) -> list["ResponseInputItemParam"]:
        from openai.types.responses.easy_input_message_param import EasyInputMessageParam
        from openai.types.responses.response_function_tool_call_param import (
            ResponseFunctionToolCallParam,
        )
        from openai.types.responses.response_input_item_param import FunctionCallOutput

        result: list["ResponseInputItemParam"] = []
        for message in messages:
            role = message["role"]
            content = message["content"] or ""
            if role is ChatCompletionMessageRole.USER:
                result.append(
                    EasyInputMessageParam(
                        role="user",
                        content=content,
                        type="message",
                    )
                )
            elif role is ChatCompletionMessageRole.SYSTEM:
                result.append(
                    EasyInputMessageParam(
                        role="system",
                        content=content,
                        type="message",
                    )
                )
            elif role is ChatCompletionMessageRole.AI:
                result.append(
                    EasyInputMessageParam(
                        role="assistant",
                        content=content,
                        type="message",
                    )
                )
                tool_calls = message.get("tool_calls")
                if tool_calls:
                    for tc in tool_calls:
                        fn = tc["function"]
                        result.append(
                            ResponseFunctionToolCallParam(
                                call_id=tc["id"],
                                name=fn["name"],
                                arguments=safe_json_dumps(fn["arguments"]),
                                type="function_call",
                            )
                        )
            elif role is ChatCompletionMessageRole.TOOL:
                tool_call_id = message.get("tool_call_id")
                if tool_call_id is not None:
                    result.append(
                        FunctionCallOutput(
                            call_id=tool_call_id,
                            output=content,
                            type="function_call_output",
                        )
                    )
            else:
                assert_never(role)
        return result

    async def _responses_create(
        self,
        *,
        messages: list[PlaygroundMessage],
        tools: list[JSONScalarType],
        span: OTelSpan,
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        """
        OpenAI Responses API (responses.create) streaming. Yields TextChunk and
        ToolCallChunk; sets span attributes from the completed response at the end.
        """
        from openai import omit

        input_item_param = self._to_openai_response_input_item_param(messages)
        completed_response: Optional["Response"] = None
        responses_tools = _tools_chat_completions_to_responses_api(tools) if tools else omit
        responses_params = _invocation_parameters_to_responses_api(dict(invocation_parameters))

        async with self._client_factory() as client:
            client._client = _HttpxClient(client._client, span=span)
            throttled_create = self.rate_limiter._alimit(client.responses.create)
            create_result = await throttled_create(
                input=input_item_param,
                model=self.model_name,
                stream=True,
                tools=cast(Any, responses_tools),
                **cast(Any, responses_params),
            )
            stream = cast("AsyncStream[ResponseStreamEvent]", create_result)
            async for event in stream:
                if event.type == "response.output_text.delta":
                    delta = event.delta
                    if delta and isinstance(delta, str):
                        yield TextChunk(content=delta)
                elif event.type == "response.output_text.done":
                    pass
                elif event.type == "response.output_item.added":
                    pass
                elif event.type == "response.output_item.done":
                    item = event.item
                    if item.type == "function_call":
                        yield ToolCallChunk(
                            id=item.call_id,
                            function=FunctionCallChunk(
                                name=item.name,
                                arguments=item.arguments,
                            ),
                        )
                    elif item.type == "custom_tool_call":
                        yield ToolCallChunk(
                            id=item.call_id,
                            function=FunctionCallChunk(
                                name=item.name,
                                arguments=item.input,
                            ),
                        )
                    elif item.type == "message":
                        pass
                    elif item.type == "file_search_call":
                        pass
                    elif item.type == "web_search_call":
                        pass
                    elif item.type == "computer_call":
                        pass
                    elif item.type == "reasoning":
                        pass
                    elif item.type == "compaction":
                        pass
                    elif item.type == "image_generation_call":
                        pass
                    elif item.type == "code_interpreter_call":
                        pass
                    elif item.type == "local_shell_call":
                        pass
                    elif item.type == "shell_call":
                        pass
                    elif item.type == "shell_call_output":
                        pass
                    elif item.type == "apply_patch_call":
                        pass
                    elif item.type == "apply_patch_call_output":
                        pass
                    elif item.type == "mcp_call":
                        pass
                    elif item.type == "mcp_list_tools":
                        pass
                    elif item.type == "mcp_approval_request":
                        pass
                    elif TYPE_CHECKING:
                        assert_never(item.type)
                elif event.type == "response.completed":
                    completed_response = event.response
                elif event.type == "response.failed":
                    resp = event.response
                    msg = "OpenAI Responses API request failed"
                    if (err := resp.error) is not None:
                        msg = err.message
                        if err.code:
                            msg = f"{msg} (code: {err.code})"
                    raise RuntimeError(msg)
                elif event.type == "response.incomplete":
                    resp = event.response
                    msg = "OpenAI Responses API request incomplete"
                    if (err := resp.error) is not None:
                        msg = err.message
                    raise RuntimeError(msg)
                elif event.type == "error":
                    msg = event.message
                    if event.code:
                        msg = f"{msg} (code: {event.code})"
                    if event.param:
                        msg = f"{msg} (param: {event.param})"
                    raise RuntimeError(msg)
                elif event.type == "response.audio.delta":
                    pass
                elif event.type == "response.audio.done":
                    pass
                elif event.type == "response.audio.transcript.delta":
                    pass
                elif event.type == "response.audio.transcript.done":
                    pass
                elif event.type == "response.code_interpreter_call_code.delta":
                    pass
                elif event.type == "response.code_interpreter_call_code.done":
                    pass
                elif event.type == "response.code_interpreter_call.completed":
                    pass
                elif event.type == "response.code_interpreter_call.in_progress":
                    pass
                elif event.type == "response.code_interpreter_call.interpreting":
                    pass
                elif event.type == "response.content_part.added":
                    pass
                elif event.type == "response.content_part.done":
                    pass
                elif event.type == "response.created":
                    pass
                elif event.type == "response.file_search_call.completed":
                    pass
                elif event.type == "response.file_search_call.in_progress":
                    pass
                elif event.type == "response.file_search_call.searching":
                    pass
                elif event.type == "response.function_call_arguments.delta":
                    pass
                elif event.type == "response.function_call_arguments.done":
                    pass
                elif event.type == "response.custom_tool_call_input.done":
                    pass
                elif event.type == "response.in_progress":
                    pass
                elif event.type == "response.reasoning_summary_part.added":
                    pass
                elif event.type == "response.reasoning_summary_part.done":
                    pass
                elif event.type == "response.reasoning_summary_text.delta":
                    pass
                elif event.type == "response.reasoning_summary_text.done":
                    pass
                elif event.type == "response.reasoning_text.delta":
                    pass
                elif event.type == "response.reasoning_text.done":
                    pass
                elif event.type == "response.refusal.delta":
                    pass
                elif event.type == "response.refusal.done":
                    pass
                elif event.type == "response.web_search_call.completed":
                    pass
                elif event.type == "response.web_search_call.in_progress":
                    pass
                elif event.type == "response.web_search_call.searching":
                    pass
                elif event.type == "response.image_generation_call.completed":
                    pass
                elif event.type == "response.image_generation_call.generating":
                    pass
                elif event.type == "response.image_generation_call.in_progress":
                    pass
                elif event.type == "response.image_generation_call.partial_image":
                    pass
                elif event.type == "response.mcp_call_arguments.delta":
                    pass
                elif event.type == "response.mcp_call_arguments.done":
                    pass
                elif event.type == "response.mcp_call.completed":
                    pass
                elif event.type == "response.mcp_call.failed":
                    pass
                elif event.type == "response.mcp_call.in_progress":
                    pass
                elif event.type == "response.mcp_list_tools.completed":
                    pass
                elif event.type == "response.mcp_list_tools.failed":
                    pass
                elif event.type == "response.mcp_list_tools.in_progress":
                    pass
                elif event.type == "response.output_text.annotation.added":
                    pass
                elif event.type == "response.queued":
                    pass
                elif event.type == "response.custom_tool_call_input.delta":
                    pass
                elif TYPE_CHECKING:
                    assert_never(event.type)

        if completed_response is not None:
            span.set_attributes(
                dict(_ResponsesApiAttributes._get_attributes_from_response(completed_response))
            )

    def to_openai_chat_completion_param(
        self,
        message: PlaygroundMessage,
    ) -> Optional["ChatCompletionMessageParam"]:
        from openai.types.chat import (
            ChatCompletionAssistantMessageParam,
            ChatCompletionSystemMessageParam,
            ChatCompletionToolMessageParam,
            ChatCompletionUserMessageParam,
        )

        role = message["role"]
        content = message["content"]
        tool_call_id = message.get("tool_call_id")
        tool_calls = message.get("tool_calls")

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
class BedrockStreamingClient(PlaygroundStreamingClient["BedrockRuntimeClient"]):
    @property
    def llm_system(self) -> str:
        return "aws"

    def __init__(
        self,
        *,
        client_factory: Callable[[], AbstractAsyncContextManager["BedrockRuntimeClient"]],
        model_name: str,
        provider: str = "aws",
    ) -> None:
        super().__init__(client_factory=client_factory, model_name=model_name, provider=provider)

    @classmethod
    def dependencies(cls) -> list[Dependency]:
        return [Dependency(name="aioboto3")]

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

    async def _chat_completion_create(
        self,
        *,
        messages: list[PlaygroundMessage],
        tools: list[JSONScalarType],
        span: OTelSpan,
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        async for chunk in self._handle_converse_api(
            messages=messages,
            tools=tools,
            span=span,
            invocation_parameters=invocation_parameters,
        ):
            yield chunk

    async def _handle_converse_api(
        self,
        *,
        messages: list[PlaygroundMessage],
        tools: list[JSONScalarType],
        span: OTelSpan,
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

        # Make the streaming API call using async context manager
        async with self._client_factory() as client:
            response = await client.converse_stream(**converse_params)

            # Track active tool calls
            active_tool_calls = {}  # contentBlockIndex -> {id, name, arguments_buffer}

            # Process the event stream asynchronously
            event_stream = response.get("stream")
            if event_stream is None:
                return

            async for event in event_stream:
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
                    span.set_attributes(
                        {
                            LLM_TOKEN_COUNT_PROMPT: event.get("metadata")
                            .get("usage", {})
                            .get("inputTokens", 0),
                            LLM_TOKEN_COUNT_COMPLETION: event.get("metadata")
                            .get("usage", {})
                            .get("outputTokens", 0),
                            LLM_TOKEN_COUNT_TOTAL: event.get("metadata")
                            .get("usage", {})
                            .get("totalTokens", 0),
                        }
                    )

    def _build_bedrock_messages(
        self,
        messages: list[PlaygroundMessage],
    ) -> tuple[list[dict[str, Any]], str]:
        bedrock_messages = []
        system_prompt = ""
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
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
        messages: list[PlaygroundMessage],
    ) -> str:
        """Extract system prompt from messages."""
        system_prompts = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if role == ChatCompletionMessageRole.SYSTEM:
                system_prompts.append(content)
        return "\n".join(system_prompts)

    def _build_converse_messages(
        self,
        messages: list[PlaygroundMessage],
    ) -> list[dict[str, Any]]:
        """Convert messages to Converse API format."""
        converse_messages: list[dict[str, Any]] = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            tool_call_id = msg.get("tool_call_id")
            tool_calls = msg.get("tool_calls")
            if role == ChatCompletionMessageRole.USER:
                converse_messages.append({"role": "user", "content": [{"text": content}]})
            elif role == ChatCompletionMessageRole.TOOL:
                converse_messages.append(
                    {
                        "role": "user",
                        "content": [
                            {
                                "toolResult": {
                                    "toolUseId": tool_call_id,
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


OPENAI_RESPONSES_API_MODELS = [
    "gpt-5.2",
    "gpt-5.2-2025-12-11",
    "gpt-5.2-chat-latest",
    "gpt-5.1",
    "gpt-5.1-2025-11-13",
    "gpt-5.1-chat-latest",
]

OPENAI_CHAT_COMPLETIONS_API_MODELS = [
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
    model_names=OPENAI_RESPONSES_API_MODELS,
)
class OpenAIResponsesAPIStreamingClient(
    OpenAIReasoningReasoningModelsMixin,
    OpenAIStreamingClient,
):
    """OpenAI Responses API (responses.create) for gpt-5.2, gpt-5.1, etc."""

    response_attributes_are_auto_accumulating = True

    @override
    async def _chat_completion_create(
        self,
        *,
        messages: list[PlaygroundMessage],
        tools: list[JSONScalarType],
        span: OTelSpan,
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        async for chunk in self._responses_create(
            messages=messages,
            tools=tools,
            span=span,
            **invocation_parameters,
        ):
            yield chunk


@register_llm_client(
    provider_key=GenerativeProviderKey.OPENAI,
    model_names=OPENAI_CHAT_COMPLETIONS_API_MODELS,
)
class OpenAIReasoningNonStreamingClient(
    OpenAIReasoningReasoningModelsMixin,
    OpenAIStreamingClient,
):
    def to_openai_chat_completion_param(
        self,
        message: PlaygroundMessage,
    ) -> Optional["ChatCompletionMessageParam"]:
        from openai.types.chat import (
            ChatCompletionAssistantMessageParam,
            ChatCompletionDeveloperMessageParam,
            ChatCompletionToolMessageParam,
            ChatCompletionUserMessageParam,
        )

        role = message["role"]
        content = message["content"]
        tool_call_id = message.get("tool_call_id")
        tool_calls = message.get("tool_calls")

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
        client_factory: Callable[[], AbstractAsyncContextManager["AsyncOpenAI"]],
        model_name: str,
        provider: str = "azure",
    ) -> None:
        super().__init__(client_factory=client_factory, model_name=model_name, provider=provider)
        self.provider = OpenInferenceLLMProviderValues.AZURE.value


@register_llm_client(
    provider_key=GenerativeProviderKey.AZURE_OPENAI,
    model_names=OPENAI_RESPONSES_API_MODELS,
)
class AzureOpenAIResponsesAPIStreamingClient(
    OpenAIReasoningReasoningModelsMixin,
    AzureOpenAIStreamingClient,
):
    """Azure OpenAI Responses API (responses.create) for gpt-5.2, gpt-5.1, etc."""

    response_attributes_are_auto_accumulating = True

    @override
    async def _chat_completion_create(
        self,
        *,
        messages: list[PlaygroundMessage],
        tools: list[JSONScalarType],
        span: OTelSpan,
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        async for chunk in self._responses_create(
            messages=messages,
            tools=tools,
            span=span,
            **invocation_parameters,
        ):
            yield chunk


@register_llm_client(
    provider_key=GenerativeProviderKey.AZURE_OPENAI,
    model_names=OPENAI_CHAT_COMPLETIONS_API_MODELS,
)
class AzureOpenAIReasoningNonStreamingClient(
    OpenAIReasoningReasoningModelsMixin,
    AzureOpenAIStreamingClient,
):
    @override
    async def _chat_completion_create(
        self,
        *,
        messages: list[PlaygroundMessage],
        tools: list[JSONScalarType],
        span: OTelSpan,
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        from openai import omit
        from openai.types import chat

        # Convert standard messages to OpenAI messages
        openai_messages = []
        for message in messages:
            openai_message = self.to_openai_chat_completion_param(message)
            if openai_message is not None:
                openai_messages.append(openai_message)

        async with self._client_factory() as client:
            # Wrap httpx client for instrumentation (fresh client each request)
            client._client = _HttpxClient(client._client, span=span)
            throttled_create = self.rate_limiter._alimit(client.chat.completions.create)
            response = cast(
                chat.ChatCompletion,
                await throttled_create(
                    messages=openai_messages,
                    model=self.model_name,
                    stream=False,
                    tools=tools or omit,
                    **invocation_parameters,
                ),
            )

        if response.usage is not None:
            span.set_attributes(dict(self._llm_token_counts(response.usage)))

        choice = response.choices[0]
        if choice.message.content:
            yield TextChunk(content=choice.message.content)

        if choice.message.tool_calls:
            for tool_call in choice.message.tool_calls:
                if tool_call.type == "function":
                    yield ToolCallChunk(
                        id=tool_call.id,
                        function=FunctionCallChunk(
                            name=tool_call.function.name,
                            arguments=tool_call.function.arguments,
                        ),
                    )
                elif tool_call.type == "custom":
                    raise NotImplementedError("custom tool calls are not supported")
                else:
                    assert_never(tool_call.type)

    def to_openai_chat_completion_param(
        self,
        message: PlaygroundMessage,
    ) -> Optional["ChatCompletionMessageParam"]:
        from openai.types.chat import (
            ChatCompletionAssistantMessageParam,
            ChatCompletionDeveloperMessageParam,
            ChatCompletionToolMessageParam,
            ChatCompletionUserMessageParam,
        )

        role = message["role"]
        content = message["content"]
        tool_call_id = message.get("tool_call_id")
        tool_calls = message.get("tool_calls")

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
class AnthropicStreamingClient(PlaygroundStreamingClient["AsyncAnthropic"]):
    @property
    def llm_system(self) -> str:
        return OpenInferenceLLMSystemValues.ANTHROPIC.value

    def __init__(
        self,
        *,
        client_factory: Callable[[], AbstractAsyncContextManager["AsyncAnthropic"]],
        model_name: str,
        provider: str = "anthropic",
    ) -> None:
        import anthropic

        super().__init__(client_factory=client_factory, model_name=model_name, provider=provider)
        self.provider = OpenInferenceLLMProviderValues.ANTHROPIC.value
        self.rate_limiter = PlaygroundRateLimiter(provider, anthropic.RateLimitError)

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

    async def _chat_completion_create(
        self,
        *,
        messages: list[PlaygroundMessage],
        tools: list[JSONScalarType],
        span: OTelSpan,
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

        async with self._client_factory() as client:
            # Wrap httpx client for instrumentation (fresh client each request)
            client._client = _HttpxClient(client._client, span=span)
            throttled_stream = self.rate_limiter._alimit(client.messages.stream)
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
                        if cache_creation_tokens := getattr(
                            usage, "cache_creation_input_tokens", None
                        ):
                            if cache_creation_tokens is not None:
                                token_counts[LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE] = (
                                    cache_creation_tokens
                                )
                        if token_counts:
                            span.set_attributes(token_counts)
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
                        if output_token_counts:
                            span.set_attributes(output_token_counts)
                    elif (
                        event.type == "content_block_stop"
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
                        # Incremental tool-call JSON; uses the complete block at content_block_stop
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
        messages: list[PlaygroundMessage],
    ) -> tuple[list["MessageParam"], str]:
        anthropic_messages: list["MessageParam"] = []
        system_prompt = ""
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            tool_call_id = msg.get("tool_call_id")
            tool_calls = msg.get("tool_calls")
            tool_aware_content = self._anthropic_message_content(content, tool_calls)
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
                                "tool_use_id": tool_call_id or "",
                                "content": content or "",
                            }
                        ],
                    }
                )
            else:
                assert_never(role)

        return anthropic_messages, system_prompt

    def _anthropic_message_content(
        self, content: str, tool_calls: Optional[Sequence[JSONScalarType]]
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
class GoogleStreamingClient(PlaygroundStreamingClient["GoogleAsyncClient"]):
    @property
    def llm_system(self) -> str:
        return OpenInferenceLLMSystemValues.VERTEXAI.value

    def __init__(
        self,
        *,
        client_factory: Callable[[], AbstractAsyncContextManager["GoogleAsyncClient"]],
        model_name: str,
        provider: str = "google",
    ) -> None:
        super().__init__(client_factory=client_factory, model_name=model_name, provider=provider)
        self.provider = OpenInferenceLLMProviderValues.GOOGLE.value

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

    async def _chat_completion_create(
        self,
        *,
        messages: list[PlaygroundMessage],
        tools: list[JSONScalarType],
        span: OTelSpan,
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

        async with self._client_factory() as client:
            stream = await client.models.generate_content_stream(
                model=f"models/{self.model_name}",
                contents=contents,
                config=config,
            )
            async for event in stream:
                # Update token counts if usage_metadata is present
                if event.usage_metadata:
                    span.set_attributes(
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
        messages: list[PlaygroundMessage],
    ) -> tuple[list["ContentType"], str]:
        """Build Google messages following the standard pattern - process ALL messages."""
        google_messages: list["ContentType"] = []
        system_prompts = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
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
        messages: list[PlaygroundMessage],
        tools: list[JSONScalarType],
        tracer: Tracer | None = None,
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

        async for chunk in super().chat_completion_create(
            messages, tools, tracer=tracer, **invocation_parameters
        ):
            yield chunk


def initialize_playground_clients() -> None:
    """
    Ensure that all playground clients are registered at import time.
    """
    pass


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
    def __init__(
        self,
        wrapped: httpx.AsyncClient,
        span: OTelSpan,
    ):
        super().__init__(wrapped)
        self._self_span = span

    async def send(self, request: httpx.Request, **kwargs: Any) -> Any:
        self._self_span.set_attribute(URL_FULL, str(request.url))
        self._self_span.set_attribute(URL_PATH, request.url.path.removeprefix(self.base_url.path))
        response = await self.__wrapped__.send(request, **kwargs)
        return response


async def get_playground_client(
    *,
    model: GenerativeModelInput,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    credentials: Sequence[GenerativeCredentialInput] | None = None,
) -> "PlaygroundStreamingClient[Any]":
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
        credentials: Optional list of credentials to use for authentication.

    Returns:
        A configured PlaygroundStreamingClient ready for chat completions.

    Raises:
        BadRequest: If required credentials are missing or invalid.
        NotFound: If a custom provider ID doesn't exist.
    """
    if builtin := model.builtin:
        return await _get_builtin_provider_client(builtin, session, decrypt, credentials)
    if custom := model.custom:
        return await _get_custom_provider_client(custom, session, decrypt)
    raise BadRequest("Model input must specify either a builtin or custom provider")


async def _resolve_secrets(
    session: AsyncSession,
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
        (str(c.value) for c in credentials if c.env_var_name == env_var_name),
        None,
    )


async def _get_builtin_provider_client(
    obj: GenerativeModelBuiltinProviderInput,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    credentials: Sequence[GenerativeCredentialInput] | None = None,
) -> "PlaygroundStreamingClient[Any]":
    """
    Create a playground client from a builtin provider configuration.

    Credentials are resolved in priority order:
    1. Explicitly provided credentials
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
            _get_credential_from_input(credentials, "OPENAI_API_KEY")
            or (await _resolve_secrets(session, decrypt, "OPENAI_API_KEY")).get("OPENAI_API_KEY")
            or getenv("OPENAI_API_KEY")
        )
        base_url = obj.base_url or getenv("OPENAI_BASE_URL")

        if not api_key:
            if not base_url:
                raise BadRequest(
                    "An API key is required for OpenAI models. "
                    "Set the OPENAI_API_KEY environment variable or use a custom provider."
                )
            api_key = "sk-placeholder"  # Some OpenAI-compatible APIs don't need a key

        # Create factory that returns fresh OpenAI client (native async context manager)
        def create_openai_client() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                default_headers=headers,
                timeout=30,
            )

        client_factory: ClientFactory = create_openai_client
        api_type = obj.openai_api_type
        if api_type is OpenAIApiType.CHAT_COMPLETIONS:
            return OpenAIStreamingClient(
                client_factory=client_factory,
                model_name=model_name,
                provider=provider,
            )
        return OpenAIResponsesAPIStreamingClient(
            client_factory=client_factory,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.AZURE_OPENAI:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        api_key = (
            _get_credential_from_input(credentials, "AZURE_OPENAI_API_KEY")
            or (await _resolve_secrets(session, decrypt, "AZURE_OPENAI_API_KEY")).get(
                "AZURE_OPENAI_API_KEY"
            )
            or getenv("AZURE_OPENAI_API_KEY")
        )
        endpoint = obj.endpoint or getenv("AZURE_OPENAI_ENDPOINT")

        if not endpoint:
            raise BadRequest(
                "An Azure endpoint is required for Azure OpenAI models. "
                "Set the AZURE_OPENAI_ENDPOINT environment variable or use a custom provider."
            )

        # Construct the v1 API base URL
        endpoint = endpoint.rstrip("/")
        base_url = (endpoint if endpoint.endswith("/openai/v1") else f"{endpoint}/openai/v1") + "/"

        # Create factory that returns fresh Azure OpenAI client (native async context manager)
        # Uses AsyncOpenAI with base_url (cleaner than AsyncAzureOpenAI)
        if api_key:

            def create_azure_client() -> AsyncOpenAI:
                return AsyncOpenAI(
                    api_key=api_key,
                    base_url=base_url,
                    default_headers=headers,
                )

            client_factory = create_azure_client
        else:
            try:
                from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider
            except ImportError:
                raise BadRequest(
                    "Provide an API key for Azure OpenAI models or install azure-identity"
                )
            # Capture token provider in closure for fresh client creation
            # Passing token_provider as api_key requires openai>=1.106.0
            token_provider = get_bearer_token_provider(
                DefaultAzureCredential(),
                "https://cognitiveservices.azure.com/.default",
            )

            def create_client_with_token() -> AsyncOpenAI:
                return AsyncOpenAI(
                    api_key=token_provider,
                    base_url=base_url,
                    default_headers=headers,
                )

            client_factory = create_client_with_token
        api_type = obj.openai_api_type
        if api_type is OpenAIApiType.CHAT_COMPLETIONS:
            return AzureOpenAIStreamingClient(
                client_factory=client_factory,
                model_name=model_name,
                provider=provider,
            )
        return AzureOpenAIResponsesAPIStreamingClient(
            client_factory=client_factory,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.ANTHROPIC:
        try:
            import anthropic
        except ImportError:
            raise BadRequest("Anthropic package not installed. Run: pip install anthropic")

        api_key = (
            _get_credential_from_input(credentials, "ANTHROPIC_API_KEY")
            or (await _resolve_secrets(session, decrypt, "ANTHROPIC_API_KEY")).get(
                "ANTHROPIC_API_KEY"
            )
            or getenv("ANTHROPIC_API_KEY")
        )
        if not api_key:
            raise BadRequest(
                "An API key is required for Anthropic models. "
                "Set the ANTHROPIC_API_KEY environment variable or use a custom provider."
            )

        # Create factory that returns fresh Anthropic client (native async context manager)
        def create_anthropic_client() -> anthropic.AsyncAnthropic:
            return anthropic.AsyncAnthropic(api_key=api_key, default_headers=headers)

        client_factory = create_anthropic_client
        if model_name in ANTHROPIC_REASONING_MODELS:
            return AnthropicReasoningStreamingClient(
                client_factory=client_factory,
                model_name=model_name,
                provider=provider,
            )
        return AnthropicStreamingClient(
            client_factory=client_factory,
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
            credentials, "GEMINI_API_KEY"
        ) or _get_credential_from_input(credentials, "GOOGLE_API_KEY")

        # Fall back to database secrets
        if not api_key:
            secrets = await _resolve_secrets(session, decrypt, "GEMINI_API_KEY", "GOOGLE_API_KEY")
            api_key = secrets.get("GEMINI_API_KEY") or secrets.get("GOOGLE_API_KEY")

        # Fall back to environment variables
        if not api_key:
            api_key = getenv("GEMINI_API_KEY") or getenv("GOOGLE_API_KEY")

        if not api_key:
            raise BadRequest(
                "An API key is required for Google GenAI models. "
                "Set the GEMINI_API_KEY environment variable or use a custom provider."
            )

        # Create factory that returns fresh Google GenAI async client (native async context manager)
        # Note: Client(api_key).aio returns the AsyncClient which is an async context manager
        def create_google_client() -> "GoogleAsyncClient":
            return GoogleGenAIClient(api_key=api_key).aio

        client_factory = create_google_client
        return GoogleStreamingClient(
            client_factory=client_factory,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.AWS:
        try:
            import aioboto3  # type: ignore[import-untyped]
        except ImportError:
            raise BadRequest("aioboto3 package not installed. Run: pip install aioboto3")

        region = obj.region or getenv("AWS_REGION") or "us-east-1"

        # Collect credentials from input
        aws_access_key_id = _get_credential_from_input(credentials, "AWS_ACCESS_KEY_ID")
        aws_secret_access_key = _get_credential_from_input(credentials, "AWS_SECRET_ACCESS_KEY")
        aws_session_token = _get_credential_from_input(credentials, "AWS_SESSION_TOKEN")

        # Fall back to database secrets for missing credentials
        if not aws_access_key_id or not aws_secret_access_key:
            secrets = await _resolve_secrets(
                session, decrypt, "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"
            )
            aws_access_key_id = aws_access_key_id or secrets.get("AWS_ACCESS_KEY_ID")
            aws_secret_access_key = aws_secret_access_key or secrets.get("AWS_SECRET_ACCESS_KEY")
            aws_session_token = aws_session_token or secrets.get("AWS_SESSION_TOKEN")

        # Fall back to environment variables
        aws_access_key_id = aws_access_key_id or getenv("AWS_ACCESS_KEY_ID")
        aws_secret_access_key = aws_secret_access_key or getenv("AWS_SECRET_ACCESS_KEY")
        aws_session_token = aws_session_token or getenv("AWS_SESSION_TOKEN")

        aioboto3_session = aioboto3.Session(
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            aws_session_token=aws_session_token,
            region_name=region,
        )

        # Create factory that returns aioboto3's ClientCreatorContext (async context manager)
        def create_bedrock_client() -> AbstractAsyncContextManager["BedrockRuntimeClient"]:
            return aioboto3_session.client(service_name="bedrock-runtime")  # type: ignore[no-any-return]

        client_factory = create_bedrock_client

        return BedrockStreamingClient(
            client_factory=client_factory,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.DEEPSEEK:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        api_key = (
            _get_credential_from_input(credentials, "DEEPSEEK_API_KEY")
            or (await _resolve_secrets(session, decrypt, "DEEPSEEK_API_KEY")).get(
                "DEEPSEEK_API_KEY"
            )
            or getenv("DEEPSEEK_API_KEY")
        )
        base_url = obj.base_url or getenv("DEEPSEEK_BASE_URL") or "https://api.deepseek.com"

        if not api_key:
            if base_url == "https://api.deepseek.com":
                raise BadRequest(
                    "An API key is required for DeepSeek models. "
                    "Set the DEEPSEEK_API_KEY environment variable or use a custom provider."
                )
            api_key = "sk-placeholder"  # Custom endpoints may not need a key

        # Create factory that returns fresh OpenAI client (native async context manager)
        def create_deepseek_client() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                default_headers=headers,
            )

        client_factory = create_deepseek_client
        return OpenAIStreamingClient(
            client_factory=client_factory,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.XAI:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        api_key = (
            _get_credential_from_input(credentials, "XAI_API_KEY")
            or (await _resolve_secrets(session, decrypt, "XAI_API_KEY")).get("XAI_API_KEY")
            or getenv("XAI_API_KEY")
        )
        base_url = obj.base_url or getenv("XAI_BASE_URL") or "https://api.x.ai/v1"

        if not api_key:
            if base_url == "https://api.x.ai/v1":
                raise BadRequest(
                    "An API key is required for xAI models. "
                    "Set the XAI_API_KEY environment variable or use a custom provider."
                )
            api_key = "sk-placeholder"  # Custom endpoints may not need a key

        # Create factory that returns fresh OpenAI client (native async context manager)
        def create_xai_client() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                default_headers=headers,
            )

        client_factory = create_xai_client
        return OpenAIStreamingClient(
            client_factory=client_factory,
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
            raise BadRequest(
                "A base URL is required for Ollama models. "
                "Set the OLLAMA_BASE_URL environment variable (e.g., http://localhost:11434/v1) "
                "or use a custom provider."
            )

        # Create factory that returns fresh OpenAI client (native async context manager)
        def create_ollama_client() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key="ollama",
                base_url=base_url,
                default_headers=headers,
            )

        client_factory = create_ollama_client
        return OpenAIStreamingClient(
            client_factory=client_factory,
            model_name=model_name,
            provider=provider,
        )

    else:
        assert_never(provider_key)


async def _get_custom_provider_client(
    obj: GenerativeModelCustomProviderInput,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
) -> "PlaygroundStreamingClient[Any]":
    """
    Create a playground client from a custom provider stored in the database.

    Loads the provider configuration, decrypts it, and creates the appropriate
    SDK client based on the provider type.

    Args:
        obj: Custom provider input containing provider ID and model details.
        session: Database session.
        decrypt: Decryption function for the stored config.

    Returns:
        A configured PlaygroundStreamingClient.

    Raises:
        NotFound: If the provider ID doesn't exist.
        BadRequest: If decryption or parsing fails, or client creation fails.
    """

    _, provider_id = from_global_id(obj.provider_id)

    provider_record = await session.get(models.GenerativeModelCustomProvider, provider_id)
    if not provider_record:
        raise NotFound(f"Custom provider with ID {obj.provider_id} not found")

    try:
        decrypted_data = decrypt(provider_record.config)
    except Exception:
        raise BadRequest("Failed to decrypt custom provider config")

    try:
        config = GenerativeModelCustomerProviderConfig.model_validate_json(decrypted_data)
    except ValidationError:
        raise BadRequest("Failed to parse custom provider config")

    model_name = obj.model_name
    provider = provider_record.provider
    headers = dict(obj.extra_headers) if obj.extra_headers else None
    cfg = config.root

    if cfg.type == "openai":
        try:
            openai_client_factory = cfg.get_client_factory(extra_headers=headers)
        except Exception as e:
            raise BadRequest(f"Failed to create {cfg.type} client factory: {e}")
        if cfg.openai_api_type == "responses":
            return OpenAIResponsesAPIStreamingClient(
                client_factory=openai_client_factory,
                model_name=model_name,
                provider=provider,
            )
        return OpenAIStreamingClient(
            client_factory=openai_client_factory,
            model_name=model_name,
            provider=provider,
        )
    elif cfg.type == "azure_openai":
        try:
            azure_openai_client_factory = cfg.get_client_factory(extra_headers=headers)
        except Exception as e:
            raise BadRequest(f"Failed to create {cfg.type} client factory: {e}")
        if cfg.openai_api_type == "responses":
            return AzureOpenAIResponsesAPIStreamingClient(
                client_factory=azure_openai_client_factory,
                model_name=model_name,
                provider=provider,
            )
        return AzureOpenAIStreamingClient(
            client_factory=azure_openai_client_factory,
            model_name=model_name,
            provider=provider,
        )
    elif cfg.type == "anthropic":
        try:
            anthropic_client_factory = cfg.get_client_factory(extra_headers=headers)
        except Exception as e:
            raise BadRequest(f"Failed to create {cfg.type} client factory: {e}")
        if model_name in ANTHROPIC_REASONING_MODELS:
            return AnthropicReasoningStreamingClient(
                client_factory=anthropic_client_factory,
                model_name=model_name,
                provider=provider,
            )
        return AnthropicStreamingClient(
            client_factory=anthropic_client_factory,
            model_name=model_name,
            provider=provider,
        )
    elif cfg.type == "aws_bedrock":
        try:
            aws_bedrock_client_factory = cfg.get_client_factory(extra_headers=headers)
        except Exception as e:
            raise BadRequest(f"Failed to create {cfg.type} client factory: {e}")
        return BedrockStreamingClient(
            client_factory=aws_bedrock_client_factory,
            model_name=model_name,
            provider=provider,
        )
    elif cfg.type == "google_genai":
        try:
            google_genai_client_factory = cfg.get_client_factory(extra_headers=headers)
        except Exception as e:
            raise BadRequest(f"Failed to create {cfg.type} client factory: {e}")
        return GoogleStreamingClient(
            client_factory=google_genai_client_factory,
            model_name=model_name,
            provider=provider,
        )
    else:
        assert_never(cfg)


def llm_span_kind() -> Iterator[tuple[str, Any]]:
    yield OPENINFERENCE_SPAN_KIND, LLM


def llm_model_name(model_name: str) -> Iterator[tuple[str, Any]]:
    yield LLM_MODEL_NAME, model_name


def _filter_invocation_parameters(
    invocation_parameters: Mapping[str, Any],
) -> dict[str, Any]:
    """Filter out sensitive keys (api_key, apiKey, credentials) from invocation parameters."""
    disallowed_keys = {"api_key", "apikey", "credentials"}
    result: dict[str, Any] = {}
    for k, v in invocation_parameters.items():
        key_lower = str(k).lower()
        if key_lower in disallowed_keys:
            continue
        if isinstance(v, dict):
            result[k] = _filter_invocation_parameters(v)
        elif isinstance(v, list):
            result[k] = [
                _filter_invocation_parameters(item) if isinstance(item, dict) else item
                for item in v
            ]
        else:
            result[k] = v
    return result


def llm_invocation_parameters(
    invocation_parameters: Mapping[str, Any],
) -> Iterator[tuple[str, Any]]:
    if invocation_parameters:
        filtered = _filter_invocation_parameters(invocation_parameters)
        if filtered:
            yield LLM_INVOCATION_PARAMETERS, safe_json_dumps(filtered)


def llm_tools(tools: list[JSONScalarType]) -> Iterator[tuple[str, Any]]:
    for tool_index, tool in enumerate(tools):
        yield f"{LLM_TOOLS}.{tool_index}.{TOOL_JSON_SCHEMA}", json.dumps(tool)


def llm_input_messages(
    messages: Iterable[PlaygroundMessage],
) -> Iterator[tuple[str, Any]]:
    oi_messages = [_playground_message_to_oi_message(message) for message in messages]
    yield from oi.get_llm_input_message_attributes(oi_messages).items()


def _playground_message_to_oi_message(message: PlaygroundMessage) -> oi.Message:
    oi_message = oi.Message()
    if (role := message.get("role")) is not None:
        oi_message["role"] = role.value.lower()
    if (content := message.get("content")) is not None:
        oi_message["content"] = content
    if (tool_call_id := message.get("tool_call_id")) is not None:
        oi_message["tool_call_id"] = tool_call_id
    if (tool_calls := message.get("tool_calls")) is not None:
        oi_message["tool_calls"] = [
            _playground_tool_call_to_oi_tool_call(tool_call) for tool_call in tool_calls
        ]
    return oi_message


def _playground_tool_call_to_oi_tool_call(tool_call: PlaygroundToolCall) -> oi.ToolCall:
    oi_tool_call = oi.ToolCall()
    if (id := tool_call.get("id")) is not None:
        oi_tool_call["id"] = id
    if (function := tool_call.get("function")) is not None:
        oi_tool_call_function = oi.ToolCallFunction()
        if (name := function.get("name")) is not None:
            oi_tool_call_function["name"] = name
        if (arguments := function.get("arguments")) is not None:
            oi_tool_call_function["arguments"] = json.dumps(arguments)
        if oi_tool_call_function:
            oi_tool_call["function"] = oi_tool_call_function
    return oi_tool_call


def _merge_tool_call_chunks_for_output(
    tool_call_chunks: defaultdict[ToolCallID, list[ToolCallChunk]],
) -> list[dict[str, Any]]:
    merged = []
    for tool_id, chunks in tool_call_chunks.items():
        if not chunks:
            continue
        first = chunks[0]
        if not first or not hasattr(first, "function"):
            continue
        arguments = "".join(c.function.arguments for c in chunks if c and hasattr(c, "function"))
        merged.append(
            {
                "id": tool_id,
                "function": {
                    "name": first.function.name or "",
                    "arguments": arguments or "{}",
                },
            }
        )
    return merged


def _output_attributes(
    text_chunks: list[TextChunk],
    tool_call_chunks: defaultdict[ToolCallID, list[ToolCallChunk]],
) -> dict[str, Any]:
    """Return output span attributes via openinference-instrumentation.

    For text-only responses, the output value is the plain text string.
    When tool calls are present, the output is wrapped in a messages structure
    to match the standard chat completion response format.
    """
    content = "".join(chunk.content for chunk in text_chunks)
    merged_tool_calls = _merge_tool_call_chunks_for_output(tool_call_chunks)
    if merged_tool_calls:
        message: dict[str, Any] = {"role": "assistant"}
        if content:
            message["content"] = content
        message["tool_calls"] = jsonify(merged_tool_calls)
        return get_output_attributes({"messages": [message]})
    if content:
        return get_output_attributes(content)
    return {}


def _llm_output_messages(
    text_chunks: list[TextChunk],
    tool_call_chunks: defaultdict[ToolCallID, list[ToolCallChunk]],
) -> Iterator[tuple[str, Any]]:
    yield f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"
    if content := "".join(chunk.content for chunk in text_chunks):
        yield f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", content
    for tool_call_index, (_tool_call_id, tool_call_chunks_) in enumerate(tool_call_chunks.items()):
        if _tool_call_id:
            yield (
                f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_ID}",
                _tool_call_id,
            )
        if tool_call_chunks_ and (name := tool_call_chunks_[0].function.name):
            yield (
                f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_NAME}",
                name,
            )
        if arguments := "".join(chunk.function.arguments for chunk in tool_call_chunks_):
            yield (
                f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}",
                arguments,
            )


JSON = OpenInferenceMimeTypeValues.JSON.value
TEXT = OpenInferenceMimeTypeValues.TEXT.value

LLM = OpenInferenceSpanKindValues.LLM.value

OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
LLM_MODEL_NAME = SpanAttributes.LLM_MODEL_NAME
LLM_INVOCATION_PARAMETERS = SpanAttributes.LLM_INVOCATION_PARAMETERS
LLM_TOOLS = SpanAttributes.LLM_TOOLS
LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
METADATA = SpanAttributes.METADATA

MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE
MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS

TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID
TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
TOOL_CALL_FUNCTION_ARGUMENTS_JSON = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON
TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID
MESSAGE_TOOL_CALL_ID = MessageAttributes.MESSAGE_TOOL_CALL_ID
TOOL_JSON_SCHEMA = ToolAttributes.TOOL_JSON_SCHEMA
