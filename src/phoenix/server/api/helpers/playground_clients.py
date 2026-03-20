from __future__ import annotations

import importlib.util
import json
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import AsyncIterator, Callable, Iterator
from contextlib import AbstractAsyncContextManager, AsyncExitStack, asynccontextmanager
from itertools import chain
from secrets import token_hex
from types import MappingProxyType
from typing import (
    TYPE_CHECKING,
    Any,
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

import httpx
import openinference.instrumentation as oi
import sqlalchemy as sa
import wrapt
from openinference.instrumentation import (
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
from opentelemetry.context import Context as OtelContext
from opentelemetry.semconv.attributes.url_attributes import URL_FULL, URL_PATH
from opentelemetry.trace import NoOpTracer, Status, StatusCode, Tracer
from opentelemetry.trace import Span as OTelSpan
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.scalars import JSON as JSONScalarType
from typing_extensions import TypeAlias, assert_never, override

from phoenix.config import getenv
from phoenix.db import models
from phoenix.db.types.model_provider import (
    GenerativeModelCustomerProviderConfig,
    ModelProvider,
    is_sdk_compatible_with_model_provider,
)
from phoenix.db.types.prompts import (
    PromptResponseFormat,
    PromptTools,
)
from phoenix.evals.models.rate_limiters import (
    RateLimiter,
)
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.message_helpers import PlaygroundMessage, PlaygroundToolCall
from phoenix.server.api.helpers.playground_registry import PROVIDER_DEFAULT, register_llm_client
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.input_types.InvocationParameters import (
    BoundedFloatInvocationParameter,
    CanonicalParameterName,
    FloatInvocationParameter,
    IntInvocationParameter,
    InvocationParameter,
    JSONInvocationParameter,
    StringInvocationParameter,
    StringListInvocationParameter,
)
from phoenix.server.api.input_types.ModelClientOptionsInput import (
    BuiltinClientOptionsInput,
    CustomClientOptionsInput,
    ModelClientOptionsInput,
    OpenAIApiType,
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
from phoenix.utilities.json import jsonify

if TYPE_CHECKING:
    from anthropic import AsyncAnthropic
    from anthropic.lib.streaming import AsyncMessageStream, AsyncMessageStreamManager
    from anthropic.types import MessageParam, TextBlockParam, ToolResultBlockParam
    from anthropic.types.message_create_params import MessageCreateParamsBase
    from anthropic.types.usage import Usage
    from google.genai.client import AsyncClient as GoogleAsyncClient
    from google.genai.types import ContentDict, GenerateContentConfig, GenerateContentResponse
    from openai import AsyncOpenAI
    from openai._streaming import AsyncStream
    from openai.lib.streaming.responses import AsyncResponseStreamManager
    from openai.types import CompletionUsage
    from openai.types.chat import (
        ChatCompletion,
        ChatCompletionMessageParam,
    )
    from openai.types.chat import (
        ChatCompletionChunk as OpenAIChatCompletionChunk,
    )
    from openai.types.chat.completion_create_params import CompletionCreateParamsBase
    from openai.types.responses import (
        Response,
        ResponseInputItemParam,
    )
    from opentelemetry.util.types import AttributeValue
    from types_aiobotocore_bedrock_runtime.client import BedrockRuntimeClient
    from types_aiobotocore_bedrock_runtime.type_defs import (
        ContentBlockTypeDef,
        ConverseResponseTypeDef,
        ConverseStreamRequestTypeDef,
        ConverseStreamResponseTypeDef,
        MessageOutputTypeDef,
        MessageTypeDef,
    )

# TypeVar for generic client type
ClientT = TypeVar("ClientT")

SetSpanAttributesFn: TypeAlias = Callable[[Mapping[str, Any]], None]
ChatCompletionChunk: TypeAlias = Union[TextChunk, ToolCallChunk]
ClientFactory: TypeAlias = Callable[[], AbstractAsyncContextManager[ClientT]]
ToolCallID: TypeAlias = str


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


class PlaygroundOutboundRateLimitError(Exception):
    """Raised when Bedrock/Gemini throttles so PlaygroundRateLimiter can adapt."""


def _reraise_if_bedrock_rate_limit(exc: BaseException) -> None:
    from botocore.exceptions import ClientError  # type: ignore[import-untyped]

    if isinstance(exc, ClientError):
        code = exc.response.get("Error", {}).get("Code", "")
        if code in ("ThrottlingException", "TooManyRequestsException"):
            raise PlaygroundOutboundRateLimitError from exc


def _reraise_if_google_rate_limit(exc: BaseException) -> None:
    status = getattr(exc, "status_code", None)
    if status == 429:
        raise PlaygroundOutboundRateLimitError from exc
    code = getattr(exc, "code", None)
    if code == 429:
        raise PlaygroundOutboundRateLimitError from exc


class PlaygroundStreamingClient(ABC, Generic[ClientT]):
    _client_factory: ClientFactory[ClientT]

    def __init__(
        self,
        *,
        client_factory: ClientFactory[ClientT],
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
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None = None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        tracer: Tracer | None = None,
        otel_context: OtelContext | None = None,
        stream_model_output: bool = True,
    ) -> AsyncIterator[ChatCompletionChunk]:
        tracer_ = tracer or NoOpTracer()
        attributes = dict(
            chain(
                llm_span_kind(),
                llm_model_name(self.model_name),
                get_llm_system_attributes(self.llm_system).items(),
                get_llm_provider_attributes(self.provider).items(),
                llm_input_messages(messages),
            )
        )

        # Use start_span (not start_as_current_span) and span.end() in finally so we never
        # attach contextvars in the generator. Avoids "Failed to detach context" /
        # "Token was created in a different Context" when the generator is closed in another task.
        # otel_context can be passed as OtelContext() by callers that want to prevent the
        # ambient OTel context from leaking its trace_id into the playground span.
        span = tracer_.start_span(
            "ChatCompletion",
            context=otel_context,
            attributes=attributes,
            set_status_on_exception=False,  # we set status manually
        )
        self._attributes = attributes
        text_chunks: list[TextChunk] = []
        tool_call_chunks: defaultdict[ToolCallID, list[ToolCallChunk]] = defaultdict(list)
        auto_accumulating = self.response_attributes_are_auto_accumulating
        try:
            async for chunk in self._chat_completion_create(
                messages=messages,
                tools=tools,
                response_format=response_format,
                invocation_parameters=invocation_parameters,
                span=span,
                stream_model_output=stream_model_output,
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
            span.record_exception(e)
            raise
        finally:
            span.end()

    @abstractmethod
    def _chat_completion_create(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
        stream_model_output: bool = True,
    ) -> AsyncIterator[ChatCompletionChunk]: ...

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
        client_factory: ClientFactory["AsyncOpenAI"],
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
                invocation_name="extra_body",
                label="Extra Body",
            ),
        ]

    def _openai_chat_completion_build_params(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
    ) -> tuple[CompletionCreateParamsBase, dict[str, Any] | None]:
        from openai.types.chat import ChatCompletionFunctionToolParam
        from openai.types.chat.completion_create_params import CompletionCreateParamsBase
        from openai.types.shared_params import ResponseFormatJSONSchema
        from openai.types.shared_params.function_definition import FunctionDefinition
        from openai.types.shared_params.response_format_json_schema import JSONSchema

        openai_messages = []
        for message in messages:
            openai_message = self._to_openai_chat_completion_message_param(message)
            if openai_message is not None:
                openai_messages.append(openai_message)

        params = CompletionCreateParamsBase(
            messages=openai_messages,
            model=self.model_name,
        )

        if tools:
            if tc := tools.tool_choice:
                if tc.type == "none":
                    params["tool_choice"] = "none"
                elif tc.type == "zero_or_more":
                    params["tool_choice"] = "auto"
                elif tc.type == "one_or_more":
                    params["tool_choice"] = "required"
                elif tc.type == "specific_function":
                    params["tool_choice"] = {
                        "type": "function",
                        "function": {"name": tc.function_name},
                    }
                else:
                    assert_never(tc.type)
            if tools.disable_parallel_tool_calls:
                params["parallel_tool_calls"] = False
            if dt := tools.tools:
                tool_list: list[ChatCompletionFunctionToolParam] = []
                for tool in dt:
                    f = tool.function
                    fn_def = FunctionDefinition(
                        name=f.name,
                        parameters=f.parameters if f.parameters else {},
                        strict=f.strict if isinstance(f.strict, bool) else None,
                    )
                    if f.description:
                        fn_def["description"] = f.description
                    tool_list.append(
                        ChatCompletionFunctionToolParam(type="function", function=fn_def)
                    )
                params["tools"] = tool_list

        if response_format:
            if response_format.type == "json_schema":
                js = response_format.json_schema
                json_schema: JSONSchema = {"name": js.name}
                if js.description:
                    json_schema["description"] = js.description
                if js.schema_:
                    json_schema["schema"] = js.schema_
                if isinstance(js.strict, bool):
                    json_schema["strict"] = js.strict
                params["response_format"] = ResponseFormatJSONSchema(
                    type="json_schema", json_schema=json_schema
                )
            elif TYPE_CHECKING:
                assert_never(response_format.type)

        if invocation_parameters:
            if "temperature" in invocation_parameters and isinstance(
                invocation_parameters["temperature"], float
            ):
                params["temperature"] = invocation_parameters["temperature"]
            if "max_completion_tokens" in invocation_parameters and isinstance(
                invocation_parameters["max_completion_tokens"], int
            ):
                params["max_completion_tokens"] = invocation_parameters["max_completion_tokens"]
            if "max_tokens" in invocation_parameters and isinstance(
                invocation_parameters["max_tokens"], int
            ):
                params["max_completion_tokens"] = invocation_parameters["max_tokens"]
            if "frequency_penalty" in invocation_parameters and isinstance(
                invocation_parameters["frequency_penalty"], float
            ):
                params["frequency_penalty"] = invocation_parameters["frequency_penalty"]
            if "presence_penalty" in invocation_parameters and isinstance(
                invocation_parameters["presence_penalty"], float
            ):
                params["presence_penalty"] = invocation_parameters["presence_penalty"]
            if "stop" in invocation_parameters and isinstance(invocation_parameters["stop"], list):
                params["stop"] = invocation_parameters["stop"]
            if "top_p" in invocation_parameters and isinstance(
                invocation_parameters["top_p"], float
            ):
                params["top_p"] = invocation_parameters["top_p"]
            if "seed" in invocation_parameters and isinstance(invocation_parameters["seed"], int):
                params["seed"] = invocation_parameters["seed"]

        extra_body: dict[str, Any] | None = None
        if "extra_body" in invocation_parameters and isinstance(
            invocation_parameters["extra_body"], dict
        ):
            extra_body = invocation_parameters["extra_body"]

        if tool_params := params.get("tools"):
            for i, tool_param in enumerate(tool_params):
                span.set_attribute(f"llm.tools.{i}.tool.json_schema", safe_json_dumps(tool_param))
        input_value = dict(params)
        if extra_body:
            input_value["extra_body"] = extra_body
        span.set_attribute(SpanAttributes.INPUT_VALUE, safe_json_dumps(input_value))
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)
        input_value.pop("messages", None)
        input_value.pop("model", None)
        input_value.pop("tools", None)
        span.set_attribute(SpanAttributes.LLM_INVOCATION_PARAMETERS, safe_json_dumps(input_value))

        return params, extra_body

    async def _openai_chat_completion_create_stream(
        self,
        *,
        client: AsyncOpenAI,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
    ) -> AsyncStream[OpenAIChatCompletionChunk]:
        from openai.types.chat import ChatCompletionStreamOptionsParam

        params, extra_body = self._openai_chat_completion_build_params(
            messages=messages,
            tools=tools,
            response_format=response_format,
            invocation_parameters=invocation_parameters,
            span=span,
        )
        params["stream_options"] = ChatCompletionStreamOptionsParam(include_usage=True)

        input_value = dict(params)
        if extra_body:
            input_value["extra_body"] = extra_body
        span.set_attribute(SpanAttributes.INPUT_VALUE, safe_json_dumps(input_value))
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)
        input_value.pop("messages", None)
        input_value.pop("model", None)
        input_value.pop("tools", None)
        span.set_attribute(SpanAttributes.LLM_INVOCATION_PARAMETERS, safe_json_dumps(input_value))

        stream = await self.rate_limiter.alimit(client.chat.completions.create)(
            **params,
            extra_body=extra_body,
            stream=True,
        )
        return stream

    async def _openai_chat_completion_create_non_stream(
        self,
        *,
        client: AsyncOpenAI,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
    ) -> "ChatCompletion":
        from openai.types.chat import ChatCompletion

        params, extra_body = self._openai_chat_completion_build_params(
            messages=messages,
            tools=tools,
            response_format=response_format,
            invocation_parameters=invocation_parameters,
            span=span,
        )
        result = await self.rate_limiter.alimit(client.chat.completions.create)(
            **params,
            extra_body=extra_body,
            stream=False,
        )
        assert isinstance(result, ChatCompletion)
        return result

    @staticmethod
    def _chunks_from_openai_chat_completion(
        completion: "ChatCompletion",
    ) -> Iterator[ChatCompletionChunk]:
        from openai.types.chat import ChatCompletion

        assert isinstance(completion, ChatCompletion)
        if not completion.choices:
            return
        choice = completion.choices[0]
        msg = choice.message
        if msg.content is not None:
            if isinstance(msg.content, str):
                yield TextChunk(content=msg.content)
            else:
                for part in msg.content:
                    if part.type == "text" and part.text:
                        yield TextChunk(content=part.text)
        if msg.tool_calls:
            for tc in msg.tool_calls:
                if tc.type == "function":
                    yield ToolCallChunk(
                        id=tc.id,
                        function=FunctionCallChunk(
                            name=tc.function.name,
                            arguments=tc.function.arguments or "",
                        ),
                    )
                elif tc.type == "custom":
                    pass
                elif TYPE_CHECKING:
                    assert_never(tc.type)

    def _openai_response_build_params(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
    ) -> tuple[Any, dict[str, Any] | None]:
        from openai.types.responses.function_tool_param import FunctionToolParam
        from openai.types.responses.response_create_params import ResponseCreateParamsBase
        from openai.types.responses.response_format_text_json_schema_config_param import (
            ResponseFormatTextJSONSchemaConfigParam,
        )
        from openai.types.responses.response_text_config_param import (
            ResponseTextConfigParam,
        )
        from openai.types.responses.tool_choice_function_param import ToolChoiceFunctionParam

        params = ResponseCreateParamsBase(
            input=self._to_openai_response_input_item_param(messages),
            model=self.model_name,
        )

        if tools:
            if tc := tools.tool_choice:
                if tc.type == "none":
                    params["tool_choice"] = "none"
                elif tc.type == "zero_or_more":
                    params["tool_choice"] = "auto"
                elif tc.type == "one_or_more":
                    params["tool_choice"] = "required"
                elif tc.type == "specific_function":
                    params["tool_choice"] = ToolChoiceFunctionParam(
                        type="function",
                        name=tc.function_name,
                    )
                else:
                    assert_never(tc.type)
            if tools.disable_parallel_tool_calls:
                params["parallel_tool_calls"] = False
            if dt := tools.tools:
                resp_tool_list: list[FunctionToolParam] = []
                for tool in dt:
                    f = tool.function
                    t = FunctionToolParam(
                        type="function",
                        name=f.name,
                        parameters=f.parameters if f.parameters else None,
                        strict=f.strict if isinstance(f.strict, bool) else None,
                    )
                    if f.description:
                        t["description"] = f.description
                    resp_tool_list.append(t)
                params["tools"] = resp_tool_list

        if response_format:
            if response_format.type == "json_schema":
                js = response_format.json_schema
                fmt = ResponseFormatTextJSONSchemaConfigParam(
                    type="json_schema",
                    name=js.name,
                    schema=js.schema_ if js.schema_ else {},
                )
                if js.description:
                    fmt["description"] = js.description
                if isinstance(js.strict, bool):
                    fmt["strict"] = js.strict
                params["text"] = ResponseTextConfigParam(format=fmt)
            elif TYPE_CHECKING:
                assert_never(response_format.type)

        if invocation_parameters:
            if "temperature" in invocation_parameters and isinstance(
                invocation_parameters["temperature"], float
            ):
                params["temperature"] = invocation_parameters["temperature"]
            if "max_completion_tokens" in invocation_parameters and isinstance(
                invocation_parameters["max_completion_tokens"], int
            ):
                params["max_output_tokens"] = invocation_parameters["max_completion_tokens"]
            if "top_p" in invocation_parameters and isinstance(
                invocation_parameters["top_p"], float
            ):
                params["top_p"] = invocation_parameters["top_p"]
            if "reasoning_effort" in invocation_parameters and isinstance(
                invocation_parameters["reasoning_effort"], str
            ):
                from openai.types.shared_params.reasoning import Reasoning
                from openai.types.shared_params.reasoning_effort import ReasoningEffort

                params["reasoning"] = Reasoning(
                    effort=cast(ReasoningEffort, invocation_parameters["reasoning_effort"])
                )

        extra_body: dict[str, Any] | None = None
        if "extra_body" in invocation_parameters and isinstance(
            invocation_parameters["extra_body"], dict
        ):
            extra_body = invocation_parameters["extra_body"]

        if tool_params := params.get("tools"):
            for i, tool_param in enumerate(tool_params):
                span.set_attribute(f"llm.tools.{i}.tool.json_schema", safe_json_dumps(tool_param))
        input_value = dict(params)
        if extra_body:
            input_value["extra_body"] = extra_body
        span.set_attribute(SpanAttributes.INPUT_VALUE, safe_json_dumps(input_value))
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)
        input_value.pop("input", None)
        input_value.pop("model", None)
        input_value.pop("tools", None)
        span.set_attribute(SpanAttributes.LLM_INVOCATION_PARAMETERS, safe_json_dumps(input_value))

        return params, extra_body

    def _to_openai_response_stream_manager(
        self,
        *,
        client: AsyncOpenAI,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
    ) -> AsyncResponseStreamManager[Any]:
        params, extra_body = self._openai_response_build_params(
            messages=messages,
            tools=tools,
            response_format=response_format,
            invocation_parameters=invocation_parameters,
            span=span,
        )
        return client.responses.stream(
            **params,
            extra_body=extra_body,
        )

    async def _chat_completion_create(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
        stream_model_output: bool = True,
    ) -> AsyncIterator[ChatCompletionChunk]:
        if not stream_model_output:
            async with AsyncExitStack() as stack:
                client = await stack.enter_async_context(self._client_factory())
                client._client = _HttpxClient(client._client, span=span)
                completion = await self._openai_chat_completion_create_non_stream(
                    client=client,
                    messages=messages,
                    tools=tools,
                    response_format=response_format,
                    invocation_parameters=invocation_parameters,
                    span=span,
                )
                if completion.usage is not None:
                    span.set_attributes(dict(self._llm_token_counts(completion.usage)))
                for chunk in self._chunks_from_openai_chat_completion(completion):
                    yield chunk
            return

        tool_call_ids: dict[int, str] = {}
        token_usage: CompletionUsage | None = None
        async with AsyncExitStack() as stack:
            client = await stack.enter_async_context(self._client_factory())
            client._client = _HttpxClient(client._client, span=span)
            openai_stream = await self._openai_chat_completion_create_stream(
                client=client,
                messages=messages,
                tools=tools,
                response_format=response_format,
                invocation_parameters=invocation_parameters,
                span=span,
            )
            async for oai_chunk in openai_stream:
                if (usage := oai_chunk.usage) is not None:
                    token_usage = usage
                if not oai_chunk.choices:
                    # for Azure, initial chunk contains the content filter
                    continue
                choice = oai_chunk.choices[0]
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
        messages: Sequence[PlaygroundMessage],
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

    @staticmethod
    def _chunks_from_openai_responses_response(resp: "Response") -> Iterator[ChatCompletionChunk]:
        for item in resp.output or []:
            if item.type == "message":
                for block in item.content or []:
                    if block.type == "output_text":
                        yield TextChunk(content=block.text)
            elif item.type == "function_call":
                yield ToolCallChunk(
                    id=item.call_id,
                    function=FunctionCallChunk(
                        name=item.name,
                        arguments=item.arguments or "",
                    ),
                )
            elif item.type == "custom_tool_call":
                yield ToolCallChunk(
                    id=item.call_id,
                    function=FunctionCallChunk(
                        name=item.name,
                        arguments=item.input or "",
                    ),
                )

    async def _responses_create(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
        stream_model_output: bool = True,
    ) -> AsyncIterator[ChatCompletionChunk]:
        """
        OpenAI Responses API (responses.create) streaming. Yields TextChunk and
        ToolCallChunk; sets span attributes from the completed response at the end.
        """
        completed_response: Optional["Response"] = None
        if not stream_model_output:
            async with AsyncExitStack() as stack:
                client = await stack.enter_async_context(self._client_factory())
                client._client = _HttpxClient(client._client, span=span)
                params, extra_body = self._openai_response_build_params(
                    messages=messages,
                    tools=tools,
                    response_format=response_format,
                    invocation_parameters=invocation_parameters,
                    span=span,
                )
                resp = await self.rate_limiter.alimit(client.responses.create)(
                    **params, extra_body=extra_body
                )
                completed_response = resp
                for chunk in self._chunks_from_openai_responses_response(resp):
                    yield chunk
            if completed_response is not None:
                span.set_attribute(OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)
                span.set_attribute(
                    OUTPUT_VALUE, completed_response.model_dump_json(exclude_none=True)
                )
                span.set_attributes(
                    dict(_ResponsesApiAttributes._get_attributes_from_response(completed_response))
                )
            return

        async with AsyncExitStack() as stack:
            client = await stack.enter_async_context(self._client_factory())
            client._client = _HttpxClient(client._client, span=span)
            stream_manager = self._to_openai_response_stream_manager(
                client=client,
                messages=messages,
                tools=tools,
                response_format=response_format,
                invocation_parameters=invocation_parameters,
                span=span,
            )
            event_stream = await self.rate_limiter.alimit(stream_manager.__aenter__)()
            stack.push_async_exit(stream_manager)
            async for event in event_stream:
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
                    elif item.type == "tool_search_call":
                        pass
                    elif item.type == "tool_search_output":
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
            span.set_attribute(OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)
            span.set_attribute(OUTPUT_VALUE, completed_response.model_dump_json(exclude_none=True))
            span.set_attributes(
                dict(_ResponsesApiAttributes._get_attributes_from_response(completed_response))
            )

    def _to_openai_chat_completion_message_param(
        self,
        message: PlaygroundMessage,
    ) -> Optional["ChatCompletionMessageParam"]:
        from openai.types.chat import (
            ChatCompletionAssistantMessageParam,
            ChatCompletionMessageToolCallParam,
            ChatCompletionSystemMessageParam,
            ChatCompletionToolMessageParam,
            ChatCompletionUserMessageParam,
        )
        from openai.types.chat.chat_completion_message_function_tool_call_param import Function

        role = message["role"]
        content = message["content"]
        tool_call_id = message.get("tool_call_id")
        tool_calls = message.get("tool_calls")

        if role is ChatCompletionMessageRole.USER:
            return ChatCompletionUserMessageParam(
                content=content,
                role="user",
            )
        if role is ChatCompletionMessageRole.SYSTEM:
            return ChatCompletionSystemMessageParam(
                content=content,
                role="system",
            )
        if role is ChatCompletionMessageRole.AI:
            if tool_calls is None:
                return ChatCompletionAssistantMessageParam(
                    content=content,
                    role="assistant",
                )
            else:
                return ChatCompletionAssistantMessageParam(
                    content=content,
                    role="assistant",
                    tool_calls=[
                        ChatCompletionMessageToolCallParam(
                            type="function",
                            id=tool_call["id"],
                            function=Function(
                                name=tool_call["function"]["name"],
                                arguments=safe_json_dumps(tool_call["function"]["arguments"]),
                            ),
                        )
                        for tool_call in tool_calls
                    ],
                )
        if role is ChatCompletionMessageRole.TOOL:
            if tool_call_id is None:
                raise ValueError("tool_call_id is required for tool messages")
            return ChatCompletionToolMessageParam(
                content=content,
                role="tool",
                tool_call_id=tool_call_id,
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
    provider_key=GenerativeProviderKey.CEREBRAS,
    model_names=[
        PROVIDER_DEFAULT,
        "llama3.1-8b",
        "gpt-oss-120b",
    ],
)
class CerebrasStreamingClient(OpenAIBaseStreamingClient):
    pass


@register_llm_client(
    provider_key=GenerativeProviderKey.FIREWORKS,
    model_names=[
        PROVIDER_DEFAULT,
    ],
)
class FireworksStreamingClient(OpenAIBaseStreamingClient):
    pass


@register_llm_client(
    provider_key=GenerativeProviderKey.GROQ,
    model_names=[
        PROVIDER_DEFAULT,
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3-32b",
        "groq/compound",
        "groq/compound-mini",
    ],
)
class GroqStreamingClient(OpenAIBaseStreamingClient):
    pass


@register_llm_client(
    provider_key=GenerativeProviderKey.MOONSHOT,
    model_names=[
        PROVIDER_DEFAULT,
        "kimi-k2-turbo-preview",
        "kimi-k2-thinking-turbo",
        "kimi-k2-thinking",
        "kimi-k2.5",
        "moonshot-v1-128k",
        "moonshot-v1-32k",
        "moonshot-v1-8k",
        "moonshot-v1-auto",
    ],
)
class MoonshotStreamingClient(OpenAIBaseStreamingClient):
    pass


@register_llm_client(
    provider_key=GenerativeProviderKey.PERPLEXITY,
    model_names=[
        PROVIDER_DEFAULT,
        "sonar-pro",
        "sonar-reasoning-pro",
        "sonar",
        "sonar-deep-research",
    ],
)
class PerplexityStreamingClient(OpenAIBaseStreamingClient):
    pass


@register_llm_client(
    provider_key=GenerativeProviderKey.TOGETHER,
    model_names=[
        PROVIDER_DEFAULT,
        "moonshotai/Kimi-K2.5",
        "deepseek-ai/DeepSeek-V3.1",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "zai-org/GLM-5",
        "zai-org/GLM-4.5-Air-FP8",
        "Qwen/Qwen3-235B-A22B-Thinking-2507",
        "deepseek-ai/DeepSeek-R1",
    ],
)
class TogetherStreamingClient(OpenAIBaseStreamingClient):
    pass


@register_llm_client(
    provider_key=GenerativeProviderKey.AWS,
    model_names=[
        PROVIDER_DEFAULT,
        "anthropic.claude-opus-4-6-v1",
        "anthropic.claude-sonnet-4-6",
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
        client_factory: ClientFactory["BedrockRuntimeClient"],
        model_name: str,
        provider: str = "aws",
    ) -> None:
        super().__init__(client_factory=client_factory, model_name=model_name, provider=provider)
        self.rate_limiter = PlaygroundRateLimiter(provider, PlaygroundOutboundRateLimitError)

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
        ]

    async def _chat_completion_create(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
        stream_model_output: bool = True,
    ) -> AsyncIterator[ChatCompletionChunk]:
        async for chunk in self._handle_converse_api(
            messages=messages,
            tools=tools,
            response_format=response_format,
            span=span,
            invocation_parameters=invocation_parameters,
            stream_model_output=stream_model_output,
        ):
            yield chunk

    def _converse_build_request(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
    ) -> ConverseStreamRequestTypeDef:
        from types_aiobotocore_bedrock_runtime.type_defs import (
            ConverseStreamRequestTypeDef,
            InferenceConfigurationTypeDef,
            JsonSchemaDefinitionTypeDef,
            OutputConfigTypeDef,
            OutputFormatStructureTypeDef,
            OutputFormatTypeDef,
            SpecificToolChoiceTypeDef,
            ToolChoiceTypeDef,
            ToolConfigurationTypeDef,
            ToolInputSchemaTypeDef,
            ToolSpecificationTypeDef,
            ToolTypeDef,
        )

        request = ConverseStreamRequestTypeDef(modelId=self.model_name)

        request["messages"] = self._build_converse_messages(messages)

        system_prompt = self._extract_system_prompt(messages)
        if system_prompt:
            request["system"] = [{"text": system_prompt}]

        inference_config = InferenceConfigurationTypeDef()
        if "max_tokens" in invocation_parameters and isinstance(
            invocation_parameters["max_tokens"], int
        ):
            inference_config["maxTokens"] = invocation_parameters["max_tokens"]
        if "temperature" in invocation_parameters and isinstance(
            invocation_parameters["temperature"], float
        ):
            inference_config["temperature"] = invocation_parameters["temperature"]
        if "top_p" in invocation_parameters and isinstance(invocation_parameters["top_p"], float):
            inference_config["topP"] = invocation_parameters["top_p"]
        if inference_config:
            request["inferenceConfig"] = inference_config

        if tools:
            tool_list: list[ToolTypeDef] = []
            for tool in tools.tools:
                fn = tool.function
                tool_spec = ToolSpecificationTypeDef(
                    name=fn.name,
                    inputSchema=ToolInputSchemaTypeDef(
                        json=fn.parameters if fn.parameters else {"type": "object"}
                    ),
                )
                if fn.description:
                    tool_spec["description"] = fn.description
                tool_list.append(ToolTypeDef(toolSpec=tool_spec))

            tool_config = ToolConfigurationTypeDef(tools=tool_list)

            if tc := tools.tool_choice:
                if tc.type == "none":
                    pass
                elif tc.type == "zero_or_more":
                    tool_config["toolChoice"] = ToolChoiceTypeDef(auto={})
                elif tc.type == "one_or_more":
                    tool_config["toolChoice"] = ToolChoiceTypeDef(any={})
                elif tc.type == "specific_function":
                    tool_config["toolChoice"] = ToolChoiceTypeDef(
                        tool=SpecificToolChoiceTypeDef(name=tc.function_name)
                    )
                elif TYPE_CHECKING:
                    assert_never(tc.type)

            request["toolConfig"] = tool_config

        if response_format:
            json_schema = JsonSchemaDefinitionTypeDef(
                schema=safe_json_dumps(response_format.json_schema.schema_ or {}),
            )
            if response_format.json_schema.name:
                json_schema["name"] = response_format.json_schema.name
            if response_format.json_schema.description:
                json_schema["description"] = response_format.json_schema.description
            request["outputConfig"] = OutputConfigTypeDef(
                textFormat=OutputFormatTypeDef(
                    type="json_schema",
                    structure=OutputFormatStructureTypeDef(jsonSchema=json_schema),
                ),
            )

        input_value: dict[str, Any] = dict(request)
        span.set_attribute(SpanAttributes.INPUT_VALUE, safe_json_dumps(input_value))
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)
        input_value.pop("messages", None)
        input_value.pop("modelId", None)
        if "toolConfig" in request:
            if "tools" in request["toolConfig"]:
                input_value["toolConfig"] = dict(request["toolConfig"])
                for i, tool_param in enumerate(input_value["toolConfig"].pop("tools")):
                    span.set_attribute(
                        f"llm.tools.{i}.tool.json_schema", safe_json_dumps(tool_param)
                    )
        span.set_attribute(SpanAttributes.LLM_INVOCATION_PARAMETERS, safe_json_dumps(input_value))

        return request

    def _chunks_from_converse_response(
        self,
        response: "ConverseResponseTypeDef",
        span: OTelSpan,
    ) -> Iterator[ChatCompletionChunk]:
        usage = response.get("usage") or {}
        if usage:
            span.set_attributes(
                {
                    LLM_TOKEN_COUNT_PROMPT: usage.get("inputTokens", 0),
                    LLM_TOKEN_COUNT_COMPLETION: usage.get("outputTokens", 0),
                    LLM_TOKEN_COUNT_TOTAL: usage.get("totalTokens", 0),
                }
            )
        output = response.get("output") or {}
        optional_message: MessageOutputTypeDef | None = output.get("message")
        for block in optional_message["content"] if optional_message else []:
            if "text" in block and (text := block.get("text")):
                yield TextChunk(content=text)
            elif "toolUse" in block and (tool_use := block.get("toolUse")):
                raw_input = tool_use.get("input")
                if isinstance(raw_input, str):
                    args_str = raw_input
                elif raw_input is not None:
                    args_str = safe_json_dumps(raw_input)
                else:
                    args_str = ""
                yield ToolCallChunk(
                    id=tool_use.get("toolUseId"),
                    function=FunctionCallChunk(
                        name=tool_use.get("name") or "",
                        arguments=args_str,
                    ),
                )

    async def _converse_stream(
        self,
        *,
        client: BedrockRuntimeClient,
        request: "ConverseStreamRequestTypeDef",
    ) -> ConverseStreamResponseTypeDef:
        async def _call() -> ConverseStreamResponseTypeDef:
            try:
                return await client.converse_stream(**request)
            except BaseException as exc:
                _reraise_if_bedrock_rate_limit(exc)
                raise

        return await self.rate_limiter.alimit(_call)()

    async def _handle_converse_api(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
        stream_model_output: bool = True,
    ) -> AsyncIterator[ChatCompletionChunk]:
        async with self._client_factory() as client:
            request = self._converse_build_request(
                messages=messages,
                tools=tools,
                response_format=response_format,
                invocation_parameters=invocation_parameters,
                span=span,
            )
            if not stream_model_output:

                async def _converse_non_stream() -> Any:
                    try:
                        return await client.converse(**request)
                    except BaseException as exc:
                        _reraise_if_bedrock_rate_limit(exc)
                        raise

                converse_response = await self.rate_limiter.alimit(_converse_non_stream)()
                for chunk in self._chunks_from_converse_response(converse_response, span):
                    yield chunk
                return

            response = await self._converse_stream(client=client, request=request)

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

    def _extract_system_prompt(
        self,
        messages: Sequence[PlaygroundMessage],
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
        messages: Sequence[PlaygroundMessage],
    ) -> list[MessageTypeDef]:
        """Convert messages to Converse API format."""
        from types_aiobotocore_bedrock_runtime.type_defs import (
            ContentBlockTypeDef,
            MessageTypeDef,
            ToolResultBlockTypeDef,
            ToolResultContentBlockTypeDef,
        )

        converse_messages: list[MessageTypeDef] = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            tool_call_id = msg.get("tool_call_id")
            tool_calls = msg.get("tool_calls")
            if role == ChatCompletionMessageRole.USER:
                converse_messages.append(
                    MessageTypeDef(
                        role="user",
                        content=[ContentBlockTypeDef(text=content)],
                    )
                )
            elif role == ChatCompletionMessageRole.TOOL:
                tool_result = ToolResultBlockTypeDef(
                    toolUseId=tool_call_id or "",
                    content=[ToolResultContentBlockTypeDef(json=json.loads(content))],
                )
                converse_messages.append(
                    MessageTypeDef(
                        role="user", content=[ContentBlockTypeDef(toolResult=tool_result)]
                    )
                )
            elif role == ChatCompletionMessageRole.AI:
                blocks: list[ContentBlockTypeDef] = []
                if content:
                    blocks.append(ContentBlockTypeDef(text=content))
                if tool_calls:
                    # tool_calls are already in Bedrock ContentBlock format
                    # ({"toolUse": {...}}) from prior AI responses
                    blocks.extend(cast(Any, tool_calls))
                converse_messages.append(MessageTypeDef(role="assistant", content=blocks))
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
    "gpt-5.4",
    "gpt-5.4-2026-03-05",
    "gpt-5.4-pro",
    "gpt-5.4-pro-2026-03-05",
    "gpt-5.3-chat-latest",
    "gpt-5.2",
    "gpt-5.2-2025-12-11",
    "gpt-5.2-chat-latest",
    "gpt-5.2-pro",
    "gpt-5.2-pro-2025-12-11",
    "gpt-5.1",
    "gpt-5.1-2025-11-13",
    "gpt-5.1-chat-latest",
    "gpt-5",
    "gpt-5-2025-08-07",
    "gpt-5-mini",
    "gpt-5-mini-2025-08-07",
    "gpt-5-nano",
    "gpt-5-nano-2025-08-07",
    "gpt-5-pro",
    "gpt-5-pro-2025-10-06",
    "gpt-5-chat",
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
    "o3-pro-2025-06-10",
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
                invocation_name="extra_body",
                label="Extra Body",
            ),
        ]


@register_llm_client(
    provider_key=GenerativeProviderKey.OPENAI,
    model_names=[
        PROVIDER_DEFAULT,
    ],
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
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
        stream_model_output: bool = True,
    ) -> AsyncIterator[ChatCompletionChunk]:
        async for chunk in self._responses_create(
            messages=messages,
            tools=tools,
            response_format=response_format,
            invocation_parameters=invocation_parameters,
            span=span,
            stream_model_output=stream_model_output,
        ):
            yield chunk


@register_llm_client(
    provider_key=GenerativeProviderKey.OPENAI,
    model_names=OPENAI_REASONING_MODELS,
)
class OpenAIReasoningNonStreamingClient(
    OpenAIReasoningReasoningModelsMixin,
    OpenAIStreamingClient,
):
    def _to_openai_chat_completion_param(
        self,
        message: PlaygroundMessage,
    ) -> Optional["ChatCompletionMessageParam"]:
        from openai.types.chat import (
            ChatCompletionAssistantMessageParam,
            ChatCompletionDeveloperMessageParam,
            ChatCompletionMessageToolCallParam,
            ChatCompletionToolMessageParam,
            ChatCompletionUserMessageParam,
        )
        from openai.types.chat.chat_completion_message_function_tool_call_param import Function

        role = message["role"]
        content = message["content"]
        tool_call_id = message.get("tool_call_id")
        tool_calls = message.get("tool_calls")

        if role is ChatCompletionMessageRole.USER:
            return ChatCompletionUserMessageParam(
                content=content,
                role="user",
            )
        if role is ChatCompletionMessageRole.SYSTEM:
            return ChatCompletionDeveloperMessageParam(
                content=content,
                role="developer",
            )
        if role is ChatCompletionMessageRole.AI:
            if tool_calls is None:
                return ChatCompletionAssistantMessageParam(
                    content=content,
                    role="assistant",
                )
            else:
                return ChatCompletionAssistantMessageParam(
                    content=content,
                    role="assistant",
                    tool_calls=[
                        ChatCompletionMessageToolCallParam(
                            type="function",
                            id=tool_call["id"],
                            function=Function(
                                name=tool_call["function"]["name"],
                                arguments=safe_json_dumps(tool_call["function"]["arguments"]),
                            ),
                        )
                        for tool_call in tool_calls
                    ],
                )
        if role is ChatCompletionMessageRole.TOOL:
            if tool_call_id is None:
                raise ValueError("tool_call_id is required for tool messages")
            return ChatCompletionToolMessageParam(
                content=content,
                role="tool",
                tool_call_id=tool_call_id,
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
        client_factory: ClientFactory["AsyncOpenAI"],
        model_name: str,
        provider: str = "azure",
    ) -> None:
        super().__init__(client_factory=client_factory, model_name=model_name, provider=provider)
        self.provider = OpenInferenceLLMProviderValues.AZURE.value


@register_llm_client(
    provider_key=GenerativeProviderKey.AZURE_OPENAI,
    model_names=OPENAI_REASONING_MODELS,
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
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
        stream_model_output: bool = True,
    ) -> AsyncIterator[ChatCompletionChunk]:
        async for chunk in self._responses_create(
            messages=messages,
            tools=tools,
            response_format=response_format,
            invocation_parameters=invocation_parameters,
            span=span,
            stream_model_output=stream_model_output,
        ):
            yield chunk


@register_llm_client(
    provider_key=GenerativeProviderKey.AZURE_OPENAI,
    model_names=OPENAI_REASONING_MODELS,
)
class AzureOpenAIReasoningNonStreamingClient(
    OpenAIReasoningReasoningModelsMixin,
    AzureOpenAIStreamingClient,
):
    @override
    def _to_openai_chat_completion_message_param(
        self,
        message: PlaygroundMessage,
    ) -> ChatCompletionMessageParam | None:
        from openai.types.chat import (
            ChatCompletionAssistantMessageParam,
            ChatCompletionDeveloperMessageParam,
            ChatCompletionMessageToolCallParam,
            ChatCompletionToolMessageParam,
            ChatCompletionUserMessageParam,
        )
        from openai.types.chat.chat_completion_message_function_tool_call_param import Function

        role = message["role"]
        content = message["content"]
        tool_call_id = message.get("tool_call_id")
        tool_calls = message.get("tool_calls")

        if role is ChatCompletionMessageRole.USER:
            return ChatCompletionUserMessageParam(
                content=content,
                role="user",
            )
        if role is ChatCompletionMessageRole.SYSTEM:
            return ChatCompletionDeveloperMessageParam(
                content=content,
                role="developer",
            )
        if role is ChatCompletionMessageRole.AI:
            if tool_calls is None:
                return ChatCompletionAssistantMessageParam(
                    content=content,
                    role="assistant",
                )
            else:
                return ChatCompletionAssistantMessageParam(
                    content=content,
                    role="assistant",
                    tool_calls=[
                        ChatCompletionMessageToolCallParam(
                            type="function",
                            id=tool_call["id"],
                            function=Function(
                                name=tool_call["function"]["name"],
                                arguments=safe_json_dumps(tool_call["function"]["arguments"]),
                            ),
                        )
                        for tool_call in tool_calls
                    ],
                )
        if role is ChatCompletionMessageRole.TOOL:
            if tool_call_id is None:
                raise ValueError("tool_call_id is required for tool messages")
            return ChatCompletionToolMessageParam(
                content=content,
                role="tool",
                tool_call_id=tool_call_id,
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
        client_factory: ClientFactory["AsyncAnthropic"],
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
        ]

    def _anthropic_message_params(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
    ) -> MessageCreateParamsBase:
        from anthropic.types import JSONOutputFormatParam, OutputConfigParam, ToolParam
        from anthropic.types.message_create_params import MessageCreateParamsBase
        from anthropic.types.thinking_config_param import ThinkingConfigParam
        from anthropic.types.tool_choice_any_param import ToolChoiceAnyParam
        from anthropic.types.tool_choice_auto_param import ToolChoiceAutoParam
        from anthropic.types.tool_choice_none_param import ToolChoiceNoneParam
        from anthropic.types.tool_choice_tool_param import ToolChoiceToolParam

        anthropic_messages, system_prompt = self._build_anthropic_messages(messages)

        params = MessageCreateParamsBase(
            messages=anthropic_messages,
            model=self.model_name,
            max_tokens=invocation_parameters.get("max_tokens", 1024),
        )

        if system_prompt:
            params["system"] = system_prompt

        if tools:
            if tc := tools.tool_choice:
                if tc.type == "none":
                    params["tool_choice"] = ToolChoiceNoneParam(type="none")
                elif tc.type == "zero_or_more":
                    choice_auto = ToolChoiceAutoParam(type="auto")
                    if tools.disable_parallel_tool_calls:
                        choice_auto["disable_parallel_tool_use"] = True
                    params["tool_choice"] = choice_auto
                elif tc.type == "one_or_more":
                    choice_any = ToolChoiceAnyParam(type="any")
                    if tools.disable_parallel_tool_calls:
                        choice_any["disable_parallel_tool_use"] = True
                    params["tool_choice"] = choice_any
                elif tc.type == "specific_function":
                    choice_tool = ToolChoiceToolParam(type="tool", name=tc.function_name)
                    if tools.disable_parallel_tool_calls:
                        choice_tool["disable_parallel_tool_use"] = True
                    params["tool_choice"] = choice_tool
                else:
                    assert_never(tc.type)
            elif tools.disable_parallel_tool_calls:
                params["tool_choice"] = ToolChoiceAutoParam(
                    type="auto", disable_parallel_tool_use=True
                )
            if dt := tools.tools:
                tool_list: list[ToolParam] = []
                for tool in dt:
                    f = tool.function
                    t = ToolParam(
                        input_schema=f.parameters if f.parameters else {"type": "object"},
                        name=f.name,
                    )
                    if f.description:
                        t["description"] = f.description
                    tool_list.append(t)
                params["tools"] = tool_list

        if response_format:
            if response_format.type == "json_schema":
                js = response_format.json_schema
                params["output_config"] = OutputConfigParam(
                    format=JSONOutputFormatParam(
                        type="json_schema",
                        schema=js.schema_ if js.schema_ else {},
                    )
                )
            elif TYPE_CHECKING:
                assert_never(response_format.type)

        if invocation_parameters:
            if "temperature" in invocation_parameters and isinstance(
                invocation_parameters["temperature"], float
            ):
                params["temperature"] = invocation_parameters["temperature"]
            if "stop_sequences" in invocation_parameters and isinstance(
                invocation_parameters["stop_sequences"], list
            ):
                params["stop_sequences"] = invocation_parameters["stop_sequences"]
            if "top_p" in invocation_parameters and isinstance(
                invocation_parameters["top_p"], float
            ):
                params["top_p"] = invocation_parameters["top_p"]
            if "top_k" in invocation_parameters and isinstance(invocation_parameters["top_k"], int):
                params["top_k"] = invocation_parameters["top_k"]
            if "thinking" in invocation_parameters and isinstance(
                invocation_parameters["thinking"], dict
            ):
                params["thinking"] = cast(ThinkingConfigParam, invocation_parameters["thinking"])

        return params

    def _anthropic_record_message_request_on_span(
        self,
        span: OTelSpan,
        params: "MessageCreateParamsBase",
    ) -> None:
        if "tools" in params:
            for i, tool_param in enumerate(params["tools"]):
                span.set_attribute(f"llm.tools.{i}.tool.json_schema", safe_json_dumps(tool_param))
        input_value = dict(params)
        span.set_attribute(SpanAttributes.INPUT_VALUE, safe_json_dumps(input_value))
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)
        input_value.pop("messages", None)
        input_value.pop("model", None)
        input_value.pop("tools", None)
        span.set_attribute(SpanAttributes.LLM_INVOCATION_PARAMETERS, safe_json_dumps(input_value))

    def _get_anthropic_message_stream_manager(
        self,
        *,
        client: AsyncAnthropic,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
    ) -> AsyncMessageStreamManager[Any]:
        params = self._anthropic_message_params(
            messages=messages,
            tools=tools,
            response_format=response_format,
            invocation_parameters=invocation_parameters,
        )
        self._anthropic_record_message_request_on_span(span, params)
        stream_manager = client.messages.stream(**params)
        return stream_manager

    def _anthropic_apply_usage_to_span(self, span: OTelSpan, usage: Usage) -> None:
        token_counts: dict[str, AttributeValue] = {}
        if prompt_tokens := (
            (usage.input_tokens or 0)
            + (usage.cache_creation_input_tokens or 0)
            + (usage.cache_read_input_tokens or 0)
        ):
            token_counts[LLM_TOKEN_COUNT_PROMPT] = prompt_tokens
        if cache_creation_tokens := usage.cache_creation_input_tokens:
            if cache_creation_tokens is not None:
                token_counts[LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE] = cache_creation_tokens
        if token_counts:
            span.set_attributes(token_counts)
        output_token_counts: dict[str, Any] = {}
        if usage.output_tokens:
            output_token_counts[LLM_TOKEN_COUNT_COMPLETION] = usage.output_tokens
        if cache_read_tokens := usage.cache_read_input_tokens:
            if cache_read_tokens is not None:
                output_token_counts[LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ] = cache_read_tokens
        if output_token_counts:
            span.set_attributes(output_token_counts)

    async def _chat_completion_create(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
        stream_model_output: bool = True,
    ) -> AsyncIterator[ChatCompletionChunk]:
        if not stream_model_output:
            async with AsyncExitStack() as stack:
                client = await stack.enter_async_context(self._client_factory())
                client._client = _HttpxClient(client._client, span=span)
                params = self._anthropic_message_params(
                    messages=messages,
                    tools=tools,
                    response_format=response_format,
                    invocation_parameters=invocation_parameters,
                )
                self._anthropic_record_message_request_on_span(span, params)
                message = await self.rate_limiter.alimit(client.messages.create)(**params)
                if message.usage:
                    self._anthropic_apply_usage_to_span(span, message.usage)
                for block in message.content:
                    if block.type == "text":
                        yield TextChunk(content=block.text)
                    elif block.type == "tool_use":
                        yield ToolCallChunk(
                            id=block.id,
                            function=FunctionCallChunk(
                                name=block.name,
                                arguments=safe_json_dumps(block.input),
                            ),
                        )
            return

        async with AsyncExitStack() as stack:
            client = await stack.enter_async_context(self._client_factory())
            # Wrap httpx client for instrumentation (fresh client each request)
            client._client = _HttpxClient(client._client, span=span)
            stream_manager = self._get_anthropic_message_stream_manager(
                client=client,
                messages=messages,
                tools=tools,
                response_format=response_format,
                invocation_parameters=invocation_parameters,
                span=span,
            )
            anthropic_message_stream: AsyncMessageStream[Any] = await self.rate_limiter.alimit(
                stream_manager.__aenter__
            )()
            stack.push_async_exit(stream_manager)
            async for event in anthropic_message_stream:
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
                elif event.type == "content_block_stop" and event.content_block.type == "tool_use":
                    tool_call_chunk = ToolCallChunk(
                        id=event.content_block.id,
                        function=FunctionCallChunk(
                            name=event.content_block.name,
                            arguments=safe_json_dumps(event.content_block.input),
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
        messages: Sequence[PlaygroundMessage],
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
    "claude-opus-4-6",
    "claude-sonnet-4-6",
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


GEMINI_2_0_MODELS = [
    PROVIDER_DEFAULT,
    "gemini-2.0-flash-lite",  # Will be deprecated and will be shut down on March 31, 2026.
    "gemini-2.0-flash-001",  # Will be deprecated and will be shut down on March 31, 2026.
]


@register_llm_client(
    provider_key=GenerativeProviderKey.GOOGLE,
    model_names=GEMINI_2_0_MODELS,
)
class GoogleStreamingClient(PlaygroundStreamingClient["GoogleAsyncClient"]):
    @property
    def llm_system(self) -> str:
        return OpenInferenceLLMSystemValues.VERTEXAI.value

    def __init__(
        self,
        *,
        client_factory: ClientFactory["GoogleAsyncClient"],
        model_name: str,
        provider: str = "google",
    ) -> None:
        super().__init__(client_factory=client_factory, model_name=model_name, provider=provider)
        self.provider = OpenInferenceLLMProviderValues.GOOGLE.value
        self.rate_limiter = PlaygroundRateLimiter(provider, PlaygroundOutboundRateLimitError)

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
        ]

    def _google_prepare_generate_content(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
    ) -> tuple[list[ContentDict], GenerateContentConfig]:
        from google.genai import types

        contents, system_prompt = self._build_google_messages(messages)

        system_instruction: str | None = None
        if system_prompt:
            system_instruction = system_prompt

        google_tools: list[types.Tool] | None = None
        google_tool_config: types.ToolConfig | None = None
        if tools:
            if dt := tools.tools:
                function_declarations = []
                for tool in dt:
                    fn = tool.function
                    fd_kwargs: dict[str, Any] = {"name": fn.name}
                    if fn.description:
                        fd_kwargs["description"] = fn.description
                    if fn.parameters:
                        fd_kwargs["parameters_json_schema"] = fn.parameters
                    function_declarations.append(types.FunctionDeclaration(**fd_kwargs))
                google_tools = [types.Tool(function_declarations=function_declarations)]

            if tc := tools.tool_choice:
                if tc.type == "none":
                    fcc = types.FunctionCallingConfig(mode=types.FunctionCallingConfigMode.NONE)
                elif tc.type == "zero_or_more":
                    fcc = types.FunctionCallingConfig(mode=types.FunctionCallingConfigMode.AUTO)
                elif tc.type == "one_or_more":
                    fcc = types.FunctionCallingConfig(mode=types.FunctionCallingConfigMode.ANY)
                elif tc.type == "specific_function":
                    fcc = types.FunctionCallingConfig(
                        mode=types.FunctionCallingConfigMode.ANY,
                        allowed_function_names=[tc.function_name],
                    )
                else:
                    assert_never(tc.type)
                google_tool_config = types.ToolConfig(function_calling_config=fcc)

        response_mime_type: str | None = None
        response_json_schema: dict[str, Any] | None = None
        if response_format:
            if response_format.type == "json_schema":
                js = response_format.json_schema
                response_mime_type = "application/json"
                if js.schema_:
                    response_json_schema = js.schema_
            elif TYPE_CHECKING:
                assert_never(response_format.type)

        temperature: float | None = None
        max_output_tokens: int | None = None
        stop_sequences: list[str] | None = None
        top_p: float | None = None
        top_k: int | None = None
        presence_penalty: float | None = None
        frequency_penalty: float | None = None
        thinking_config: types.ThinkingConfig | None = None
        if invocation_parameters:
            if "temperature" in invocation_parameters and isinstance(
                invocation_parameters["temperature"], float
            ):
                temperature = invocation_parameters["temperature"]
            if "max_output_tokens" in invocation_parameters and isinstance(
                invocation_parameters["max_output_tokens"], int
            ):
                max_output_tokens = invocation_parameters["max_output_tokens"]
            if "stop_sequences" in invocation_parameters and isinstance(
                invocation_parameters["stop_sequences"], list
            ):
                stop_sequences = invocation_parameters["stop_sequences"]
            if "top_p" in invocation_parameters and isinstance(
                invocation_parameters["top_p"], float
            ):
                top_p = invocation_parameters["top_p"]
            if "top_k" in invocation_parameters and isinstance(invocation_parameters["top_k"], int):
                top_k = invocation_parameters["top_k"]
            if "presence_penalty" in invocation_parameters and isinstance(
                invocation_parameters["presence_penalty"], float
            ):
                presence_penalty = invocation_parameters["presence_penalty"]
            if "frequency_penalty" in invocation_parameters and isinstance(
                invocation_parameters["frequency_penalty"], float
            ):
                frequency_penalty = invocation_parameters["frequency_penalty"]
            if "thinking_config" in invocation_parameters and isinstance(
                invocation_parameters["thinking_config"], dict
            ):
                thinking_config = types.ThinkingConfig.model_validate(
                    invocation_parameters["thinking_config"]
                )

        config = types.GenerateContentConfig(
            tools=google_tools,
            tool_config=google_tool_config,
            system_instruction=system_instruction,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            stop_sequences=stop_sequences,
            top_p=top_p,
            top_k=top_k,
            presence_penalty=presence_penalty,
            frequency_penalty=frequency_penalty,
            thinking_config=thinking_config,
            response_mime_type=response_mime_type,
            response_json_schema=response_json_schema,
        )

        if google_tools:
            tool_idx = 0
            for google_tool in google_tools:
                if google_tool.function_declarations:
                    for fn_decl in google_tool.function_declarations:
                        span.set_attribute(
                            f"llm.tools.{tool_idx}.tool.json_schema",
                            safe_json_dumps(fn_decl.model_dump(exclude_none=True)),
                        )
                        tool_idx += 1

        config_dict = config.model_dump(exclude_none=True)
        input_value: dict[str, Any] = {
            "model": self.model_name,
            "contents": contents,
            "config": config_dict,
        }
        span.set_attribute(SpanAttributes.INPUT_VALUE, safe_json_dumps(input_value))
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)
        config_dict.pop("tools", None)
        config_dict.pop("system_instruction", None)
        span.set_attribute(SpanAttributes.LLM_INVOCATION_PARAMETERS, safe_json_dumps(config_dict))

        return contents, config

    def _iter_gemini_response_chunks(
        self,
        event: "GenerateContentResponse",
        span: OTelSpan,
    ) -> Iterator[ChatCompletionChunk]:
        if event.usage_metadata:
            token_counts = {}
            if event.usage_metadata.prompt_token_count is not None:
                token_counts[LLM_TOKEN_COUNT_PROMPT] = event.usage_metadata.prompt_token_count
            if event.usage_metadata.candidates_token_count is not None:
                token_counts[LLM_TOKEN_COUNT_COMPLETION] = (
                    event.usage_metadata.candidates_token_count
                )
            if event.usage_metadata.total_token_count is not None:
                token_counts[LLM_TOKEN_COUNT_TOTAL] = event.usage_metadata.total_token_count
            if token_counts:
                span.set_attributes(token_counts)

        if event.candidates:
            candidate = event.candidates[0]
            if candidate.content and candidate.content.parts:
                for part in candidate.content.parts:
                    if function_call := part.function_call:
                        # Gemini often returns an empty or ``None``
                        # ``id`` on ``FunctionCall``.  The frontend
                        # merges streamed tool-call chunks by ``id``,
                        # so when every call arrives as ``""`` they all
                        # collapse into one entry with garbled
                        # arguments.  This class assigns a stable
                        # synthetic ID (``tool_call_0``,
                        # ``tool_call_1``, …) whenever the upstream
                        # ``id`` is falsy, while preserving real IDs
                        # when Gemini provides them.

                        # This converter assumes each ``FunctionCall``
                        # is self-contained — i.e. ``name`` and
                        # ``args`` are both present on the same
                        # object.  If they were ever split across
                        # separate ``FunctionCall`` messages, the
                        # converter would emit two incorrect
                        # ``ToolCallChunk`` objects (one with the
                        # name but empty args, another with args but
                        # an empty name).  This assumption is safe
                        # today: the Gemini API always delivers
                        # complete function calls, and the SDK itself
                        # makes the same assumption — it performs no
                        # reassembly of ``FunctionCall`` fields
                        # (``_Candidate_from_mldev`` passes
                        # ``content`` through to Pydantic's
                        # ``model_validate`` as-is).

                        # The only mechanism that could disassociate
                        # ``name`` and ``args`` is the
                        # ``will_continue`` / ``partial_args``
                        # incremental streaming protocol.  As of this
                        # writing, both fields are rejected by the
                        # Gemini API with ``ValueError`` (see
                        # ``google.genai.models``).  They are only
                        # supported by the Vertex AI surface behind
                        # the ``stream_function_call_arguments``
                        # tool-config flag.  If Vertex AI support is
                        # added in the future, this class should be
                        # extended to buffer partial calls
                        # (``will_continue=True``) and reassemble
                        # ``partial_args`` using their ``json_path``
                        # keys.
                        yield ToolCallChunk(
                            id=function_call.id or token_hex(4),
                            function=FunctionCallChunk(
                                name=function_call.name or "",
                                arguments=safe_json_dumps(function_call.args or {}),
                            ),
                        )
                    elif text := part.text:
                        yield TextChunk(content=text)

    async def _chat_completion_create(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        span: OTelSpan,
        stream_model_output: bool = True,
    ) -> AsyncIterator[ChatCompletionChunk]:
        contents, config = self._google_prepare_generate_content(
            messages=messages,
            tools=tools,
            response_format=response_format,
            invocation_parameters=invocation_parameters,
            span=span,
        )
        if not stream_model_output:
            async with self._client_factory() as client:

                async def _generate() -> Any:
                    try:
                        return await client.models.generate_content(
                            model=self.model_name,
                            contents=contents,
                            config=config,
                        )
                    except BaseException as exc:
                        _reraise_if_google_rate_limit(exc)
                        raise

                response = await self.rate_limiter.alimit(_generate)()
                for chunk in self._iter_gemini_response_chunks(response, span):
                    yield chunk
            return

        async with self._client_factory() as client:

            async def _generate_stream() -> Any:
                try:
                    return await client.models.generate_content_stream(
                        model=self.model_name,
                        contents=contents,
                        config=config,
                    )
                except BaseException as exc:
                    _reraise_if_google_rate_limit(exc)
                    raise

            gemini_stream = await self.rate_limiter.alimit(_generate_stream)()
            async for event in gemini_stream:
                for chunk in self._iter_gemini_response_chunks(event, span):
                    yield chunk

    def _build_google_messages(
        self,
        messages: Sequence[PlaygroundMessage],
    ) -> tuple[list["ContentDict"], str]:
        """Build Google messages following the standard pattern - process ALL messages."""
        google_messages: list["ContentDict"] = []
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


GEMINI_2_5_MODELS = [
    PROVIDER_DEFAULT,
    "gemini-2.5-pro",  # Will be deprecated and will be shut down on June 17, 2026.
    "gemini-2.5-flash",  # Will be deprecated and will be shut down on June 17, 2026.
    "gemini-2.5-flash-lite",  # Will be deprecated and will be shut down on July 22, 2026.
]


@register_llm_client(
    provider_key=GenerativeProviderKey.GOOGLE,
    model_names=GEMINI_2_5_MODELS,
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
        ]


GEMINI_3_MODELS = [
    "gemini-3.1-pro-preview",
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
]


@register_llm_client(
    provider_key=GenerativeProviderKey.GOOGLE,
    model_names=GEMINI_3_MODELS,
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
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None = None,
        invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
        tracer: Tracer | None = None,
        otel_context: OtelContext | None = None,
        stream_model_output: bool = True,
    ) -> AsyncIterator[ChatCompletionChunk]:
        # Extract thinking_level and construct thinking_config
        params = dict(invocation_parameters)
        thinking_level = params.pop("thinking_level", None)

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
            params["thinking_config"] = {
                "include_thoughts": True,
                "thinking_level": thinking_level.upper(),
            }

        async for chunk in super().chat_completion_create(
            messages=messages,
            tools=tools,
            response_format=response_format,
            invocation_parameters=params,
            tracer=tracer,
            otel_context=otel_context,
            stream_model_output=stream_model_output,
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

    async def send(self, request: httpx.Request, **kwargs: Any) -> httpx.Response:
        self._self_span.set_attribute(URL_FULL, str(request.url))
        self._self_span.set_attribute(URL_PATH, request.url.path.removeprefix(self.base_url.path))
        response = await self.__wrapped__.send(request, **kwargs)
        return cast(httpx.Response, response)


async def get_playground_client(
    *,
    model_provider: ModelProvider,
    model_name: str,
    custom_provider_id: int | None = None,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    credentials: Sequence[GenerativeCredentialInput] | None = None,
    client_options: ModelClientOptionsInput | None = None,
) -> "PlaygroundStreamingClient[Any]":
    """
    Create a playground streaming client for the given model configuration.

    Resolves credentials and configuration, then returns a client ready for
    chat completions.  This is the single public entry point; callers should
    never need to call the builtin/custom helpers directly.

    Args:
        model_provider: Canonical model provider enum (DB-level type).
        model_name: Model name (or Azure deployment name).
        custom_provider_id: Raw DB primary key of the custom provider, or
            None for a builtin provider.
        session: Async database session (used for secret resolution and
            custom-provider lookup).
        decrypt: Decryption function for encrypted values in the database.
        credentials: Optional explicit credentials (highest priority).
        client_options: Optional connection overrides from the playground UI.
    """
    if custom_provider_id is None:
        builtin_opts = (client_options.builtin or None) if client_options else None
        return await _get_builtin_provider_client(
            model_provider=model_provider,
            model_name=model_name,
            client_options=builtin_opts,
            session=session,
            decrypt=decrypt,
            credentials=credentials,
        )

    provider_record = await session.get(models.GenerativeModelCustomProvider, custom_provider_id)
    if not provider_record:
        raise NotFound(f"Custom provider with ID {custom_provider_id} not found")

    if not is_sdk_compatible_with_model_provider(provider_record.sdk, model_provider):
        raise BadRequest(
            f"Custom provider '{provider_record.name}' has SDK '{provider_record.sdk}' "
            f"which is not compatible with model provider '{model_provider.value}'."
        )

    custom_opts = (client_options.custom or None) if client_options else None
    return await _get_custom_provider_client(
        provider_record=provider_record,
        model_name=model_name,
        client_options=custom_opts,
        decrypt=decrypt,
    )


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


def get_openai_client_class(
    provider_key: "GenerativeProviderKey",
    model_name: str,
    openai_api_type: Optional["OpenAIApiType"] = None,
) -> Optional[type["PlaygroundStreamingClient[Any]"]]:
    """
    Get the appropriate OpenAI/Azure client class based on provider, model, and API type.

    This function centralizes the logic for selecting the correct client class for
    OpenAI and Azure OpenAI providers, ensuring consistency between parameter fetching
    and client instantiation.

    For non-OpenAI providers, returns None (callers should fall back to the registry).

    Args:
        provider_key: The generative provider (OPENAI, AZURE_OPENAI, etc.)
        model_name: The name of the model
        openai_api_type: The API type (CHAT_COMPLETIONS or RESPONSES). If None,
            falls back to registry behavior.

    Returns:
        The appropriate client class, or None if the provider is not OpenAI/Azure.
    """
    from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY
    from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey

    if provider_key == GenerativeProviderKey.OPENAI:
        if openai_api_type == OpenAIApiType.CHAT_COMPLETIONS:
            if model_name in OPENAI_REASONING_MODELS:
                return OpenAIReasoningNonStreamingClient
            return OpenAIStreamingClient
        elif openai_api_type == OpenAIApiType.RESPONSES:
            return OpenAIResponsesAPIStreamingClient
        # If openai_api_type is None, fall back to registry
        return PLAYGROUND_CLIENT_REGISTRY.get_client(provider_key, model_name)

    elif provider_key == GenerativeProviderKey.AZURE_OPENAI:
        if openai_api_type == OpenAIApiType.CHAT_COMPLETIONS:
            if model_name in OPENAI_REASONING_MODELS:
                return AzureOpenAIReasoningNonStreamingClient
            return AzureOpenAIStreamingClient
        elif openai_api_type == OpenAIApiType.RESPONSES:
            return AzureOpenAIResponsesAPIStreamingClient
        # If openai_api_type is None, fall back to registry
        return PLAYGROUND_CLIENT_REGISTRY.get_client(provider_key, model_name)

    # For non-OpenAI providers, return None to signal caller should use registry
    return None


async def _get_builtin_provider_client(
    model_provider: ModelProvider,
    model_name: str,
    client_options: BuiltinClientOptionsInput | None,
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
    headers = (
        dict(client_options.custom_headers)
        if client_options and client_options.custom_headers
        else None
    )
    provider_key = GenerativeProviderKey.from_model_provider(model_provider)
    provider = GENERATIVE_PROVIDER_KEY_TO_PROVIDER_STRING[provider_key]

    base_url = client_options.base_url if client_options and client_options.base_url else None
    endpoint = client_options.endpoint if client_options and client_options.endpoint else None
    region = client_options.region if client_options and client_options.region else None
    openai_api_type = (
        client_options.openai_api_type
        if client_options and client_options.openai_api_type
        else None
    )

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
        base_url = base_url or getenv("OPENAI_BASE_URL")

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

        client_factory: ClientFactory[Any] = create_openai_client
        client_class = get_openai_client_class(provider_key, model_name, openai_api_type)
        if client_class is None:
            raise BadRequest(f"No client found for OpenAI model: {model_name}")
        return client_class(
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
        endpoint = endpoint or getenv("AZURE_OPENAI_ENDPOINT")

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
        client_class = get_openai_client_class(provider_key, model_name, openai_api_type)
        if client_class is None:
            raise BadRequest(f"No client found for Azure OpenAI model: {model_name}")
        return client_class(
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

        # Wrapped with @asynccontextmanager because Google's AsyncClient has
        # a non-standard __aexit__ signature that doesn't conform to
        # AbstractAsyncContextManager (returns None instead of bool | None).
        @asynccontextmanager
        async def create_google_client() -> "AsyncIterator[GoogleAsyncClient]":
            async with GoogleGenAIClient(api_key=api_key).aio as client:
                yield client

        client_factory = create_google_client
        if model_name in GEMINI_2_0_MODELS:
            return GoogleStreamingClient(
                client_factory=client_factory,
                model_name=model_name,
                provider=provider,
            )
        if model_name in GEMINI_2_5_MODELS:
            return Gemini25GoogleStreamingClient(
                client_factory=client_factory,
                model_name=model_name,
                provider=provider,
            )
        return Gemini3GoogleStreamingClient(
            client_factory=client_factory,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.AWS:
        try:
            import aioboto3  # type: ignore[import-untyped]
        except ImportError:
            raise BadRequest("aioboto3 package not installed. Run: pip install aioboto3")

        region = region or getenv("AWS_REGION") or "us-east-1"

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
        base_url = base_url or getenv("DEEPSEEK_BASE_URL") or "https://api.deepseek.com"

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
        base_url = base_url or getenv("XAI_BASE_URL") or "https://api.x.ai/v1"

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

        base_url = base_url or getenv("OLLAMA_BASE_URL")
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

    elif provider_key == GenerativeProviderKey.CEREBRAS:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        api_key = (
            _get_credential_from_input(credentials, "CEREBRAS_API_KEY")
            or (await _resolve_secrets(session, decrypt, "CEREBRAS_API_KEY")).get(
                "CEREBRAS_API_KEY"
            )
            or getenv("CEREBRAS_API_KEY")
        )
        base_url = base_url or getenv("CEREBRAS_BASE_URL") or "https://api.cerebras.ai/v1"

        if not api_key:
            if base_url == "https://api.cerebras.ai/v1":
                raise BadRequest(
                    "An API key is required for Cerebras models. "
                    "Set the CEREBRAS_API_KEY environment variable or use a custom provider."
                )
            api_key = "sk-placeholder"

        def create_cerebras_client() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                default_headers=headers,
            )

        client_factory = create_cerebras_client
        return OpenAIStreamingClient(
            client_factory=client_factory,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.FIREWORKS:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        api_key = (
            _get_credential_from_input(credentials, "FIREWORKS_API_KEY")
            or (await _resolve_secrets(session, decrypt, "FIREWORKS_API_KEY")).get(
                "FIREWORKS_API_KEY"
            )
            or getenv("FIREWORKS_API_KEY")
        )
        base_url = (
            base_url or getenv("FIREWORKS_BASE_URL") or "https://api.fireworks.ai/inference/v1"
        )

        if not api_key:
            if base_url == "https://api.fireworks.ai/inference/v1":
                raise BadRequest(
                    "An API key is required for Fireworks models. "
                    "Set the FIREWORKS_API_KEY environment variable or use a custom provider."
                )
            api_key = "sk-placeholder"

        def create_fireworks_client() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                default_headers=headers,
            )

        client_factory = create_fireworks_client
        return OpenAIStreamingClient(
            client_factory=client_factory,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.GROQ:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        api_key = (
            _get_credential_from_input(credentials, "GROQ_API_KEY")
            or (await _resolve_secrets(session, decrypt, "GROQ_API_KEY")).get("GROQ_API_KEY")
            or getenv("GROQ_API_KEY")
        )
        base_url = base_url or getenv("GROQ_BASE_URL") or "https://api.groq.com/openai/v1"

        if not api_key:
            if base_url == "https://api.groq.com/openai/v1":
                raise BadRequest(
                    "An API key is required for Groq models. "
                    "Set the GROQ_API_KEY environment variable or use a custom provider."
                )
            api_key = "sk-placeholder"

        def create_groq_client() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                default_headers=headers,
            )

        client_factory = create_groq_client
        return OpenAIStreamingClient(
            client_factory=client_factory,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.MOONSHOT:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        api_key = (
            _get_credential_from_input(credentials, "MOONSHOT_API_KEY")
            or (await _resolve_secrets(session, decrypt, "MOONSHOT_API_KEY")).get(
                "MOONSHOT_API_KEY"
            )
            or getenv("MOONSHOT_API_KEY")
        )
        base_url = base_url or getenv("MOONSHOT_BASE_URL") or "https://api.moonshot.ai/v1"

        if not api_key:
            if base_url == "https://api.moonshot.ai/v1":
                raise BadRequest(
                    "An API key is required for Moonshot models. "
                    "Set the MOONSHOT_API_KEY environment variable or use a custom provider."
                )
            api_key = "sk-placeholder"

        def create_moonshot_client() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                default_headers=headers,
            )

        client_factory = create_moonshot_client
        return OpenAIStreamingClient(
            client_factory=client_factory,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.PERPLEXITY:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        api_key = (
            _get_credential_from_input(credentials, "PERPLEXITY_API_KEY")
            or (await _resolve_secrets(session, decrypt, "PERPLEXITY_API_KEY")).get(
                "PERPLEXITY_API_KEY"
            )
            or getenv("PERPLEXITY_API_KEY")
        )
        base_url = base_url or getenv("PERPLEXITY_BASE_URL") or "https://api.perplexity.ai"

        if not api_key:
            if base_url == "https://api.perplexity.ai":
                raise BadRequest(
                    "An API key is required for Perplexity models. "
                    "Set the PERPLEXITY_API_KEY environment variable or use a custom provider."
                )
            api_key = "sk-placeholder"

        def create_perplexity_client() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                default_headers=headers,
            )

        client_factory = create_perplexity_client
        return OpenAIStreamingClient(
            client_factory=client_factory,
            model_name=model_name,
            provider=provider,
        )

    elif provider_key == GenerativeProviderKey.TOGETHER:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise BadRequest("OpenAI package not installed. Run: pip install openai")

        api_key = (
            _get_credential_from_input(credentials, "TOGETHER_API_KEY")
            or (await _resolve_secrets(session, decrypt, "TOGETHER_API_KEY")).get(
                "TOGETHER_API_KEY"
            )
            or getenv("TOGETHER_API_KEY")
        )
        base_url = base_url or getenv("TOGETHER_BASE_URL") or "https://api.together.xyz/v1"

        if not api_key:
            if base_url == "https://api.together.xyz/v1":
                raise BadRequest(
                    "An API key is required for Together AI models. "
                    "Set the TOGETHER_API_KEY environment variable or use a custom provider."
                )
            api_key = "sk-placeholder"

        def create_together_client() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                default_headers=headers,
            )

        client_factory = create_together_client
        return OpenAIStreamingClient(
            client_factory=client_factory,
            model_name=model_name,
            provider=provider,
        )

    else:
        assert_never(provider_key)


async def _get_custom_provider_client(
    provider_record: models.GenerativeModelCustomProvider,
    model_name: str,
    client_options: CustomClientOptionsInput | None,
    decrypt: Callable[[bytes], bytes],
) -> "PlaygroundStreamingClient[Any]":
    """
    Create a playground client from a custom provider stored in the database.

    Decrypts the provider configuration and creates the appropriate SDK client.

    Args:
        provider_record: The custom provider DB record (already fetched).
        model_name: The model name to use.
        client_options: Optional extra headers for the client.
        decrypt: Decryption function for the stored config.

    Returns:
        A configured PlaygroundStreamingClient.

    Raises:
        BadRequest: If decryption or parsing fails, or client creation fails.
    """

    try:
        decrypted_data = decrypt(provider_record.config)
    except Exception:
        raise BadRequest("Failed to decrypt custom provider config")

    try:
        config = GenerativeModelCustomerProviderConfig.model_validate_json(decrypted_data)
    except ValidationError:
        raise BadRequest("Failed to parse custom provider config")

    provider = provider_record.provider
    headers = (
        dict(client_options.extra_headers)
        if client_options and client_options.extra_headers
        else None
    )
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
        if model_name in GEMINI_2_0_MODELS:
            return GoogleStreamingClient(
                client_factory=google_genai_client_factory,
                model_name=model_name,
                provider=provider,
            )
        if model_name in GEMINI_2_5_MODELS:
            return Gemini25GoogleStreamingClient(
                client_factory=google_genai_client_factory,
                model_name=model_name,
                provider=provider,
            )
        return Gemini3GoogleStreamingClient(
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
            oi_tool_call_function["arguments"] = safe_json_dumps(arguments)
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
