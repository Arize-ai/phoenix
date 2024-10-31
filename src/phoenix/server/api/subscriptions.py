import json
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import AsyncIterator, Callable, Iterable, Iterator, Mapping
from dataclasses import asdict
from datetime import datetime, timezone
from enum import Enum
from itertools import chain
from traceback import format_exc
from types import TracebackType
from typing import (
    TYPE_CHECKING,
    Annotated,
    Any,
    Optional,
    Self,
    Union,
    cast,
)

import strawberry
from openinference.instrumentation import safe_json_dumps
from openinference.semconv.trace import (
    MessageAttributes,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolAttributes,
    ToolCallAttributes,
)
from opentelemetry.sdk.trace.id_generator import RandomIdGenerator as DefaultOTelIDGenerator
from opentelemetry.trace import StatusCode
from sqlalchemy import insert, select
from strawberry import UNSET
from strawberry.scalars import JSON as JSONScalarType
from strawberry.types import Info
from typing_extensions import TypeAlias, assert_never

from phoenix.datetime_utils import local_now, normalize_datetime
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.playground_registry import (
    PLAYGROUND_CLIENT_REGISTRY,
    PROVIDER_DEFAULT,
    register_llm_client,
)
from phoenix.server.api.input_types.ChatCompletionMessageInput import ChatCompletionMessageInput
from phoenix.server.api.input_types.InvocationParameters import (
    BoundedFloatInvocationParameter,
    CanonicalParameterName,
    IntInvocationParameter,
    InvocationParameter,
    InvocationParameterInput,
    JSONInvocationParameter,
    StringListInvocationParameter,
    extract_parameter,
    validate_invocation_parameters,
)
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.Span import Span, to_gql_span
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.server.types import DbSessionFactory
from phoenix.trace.attributes import unflatten
from phoenix.trace.schemas import (
    SpanEvent,
    SpanException,
)
from phoenix.utilities.json import jsonify
from phoenix.utilities.template_formatters import (
    FStringTemplateFormatter,
    MustacheTemplateFormatter,
    TemplateFormatter,
)

if TYPE_CHECKING:
    from anthropic.types import MessageParam
    from openai.types import CompletionUsage
    from openai.types.chat import (
        ChatCompletionMessageParam,
        ChatCompletionMessageToolCallParam,
    )

PLAYGROUND_PROJECT_NAME = "playground"

ChatCompletionMessage: TypeAlias = tuple[
    ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]
]
ToolCallID: TypeAlias = str
SetSpanAttributesFn: TypeAlias = Callable[[Mapping[str, Any]], None]


@strawberry.enum
class TemplateLanguage(Enum):
    MUSTACHE = "MUSTACHE"
    F_STRING = "F_STRING"


@strawberry.input
class TemplateOptions:
    variables: JSONScalarType
    language: TemplateLanguage


@strawberry.type
class TextChunk:
    content: str


@strawberry.type
class FunctionCallChunk:
    name: str
    arguments: str


@strawberry.type
class ToolCallChunk:
    id: str
    function: FunctionCallChunk


@strawberry.type
class FinishedChatCompletion:
    span: Span
    error_message: Optional[str] = None


ChatCompletionChunk: TypeAlias = Union[TextChunk, ToolCallChunk]

ChatCompletionSubscriptionPayload: TypeAlias = Annotated[
    Union[TextChunk, ToolCallChunk, FinishedChatCompletion],
    strawberry.union("ChatCompletionSubscriptionPayload"),
]


@strawberry.input
class GenerativeModelInput:
    provider_key: GenerativeProviderKey
    name: str
    """ The name of the model. Or the Deployment Name for Azure OpenAI models. """
    endpoint: Optional[str] = UNSET
    """ The endpoint to use for the model. Only required for Azure OpenAI models. """
    api_version: Optional[str] = UNSET
    """ The API version to use for the model. """


@strawberry.input
class ChatCompletionInput:
    messages: list[ChatCompletionMessageInput]
    model: GenerativeModelInput
    invocation_parameters: list[InvocationParameterInput] = strawberry.field(default_factory=list)
    tools: Optional[list[JSONScalarType]] = UNSET
    template: Optional[TemplateOptions] = UNSET
    api_key: Optional[str] = strawberry.field(default=None)


class PlaygroundStreamingClient(ABC):
    def __init__(
        self,
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
        set_span_attributes: Optional[SetSpanAttributesFn] = None,
    ) -> None:
        self._set_span_attributes = set_span_attributes

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


@register_llm_client(
    provider_key=GenerativeProviderKey.OPENAI,
    model_names=[
        PROVIDER_DEFAULT,
        "gpt-4o",
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
        "gpt-3.5-turbo-instruct",
    ],
)
class OpenAIStreamingClient(PlaygroundStreamingClient):
    def __init__(
        self,
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
        set_span_attributes: Optional[SetSpanAttributesFn] = None,
    ) -> None:
        from openai import AsyncOpenAI

        super().__init__(model=model, api_key=api_key, set_span_attributes=set_span_attributes)
        self.client = AsyncOpenAI(api_key=api_key)
        self.model_name = model.name

    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        return [
            BoundedFloatInvocationParameter(
                invocation_name="temperature",
                canonical_name=CanonicalParameterName.TEMPERATURE,
                label="Temperature",
                default_value=0.0,
                min_value=0.0,
                max_value=2.0,
            ),
            IntInvocationParameter(
                invocation_name="max_tokens",
                canonical_name=CanonicalParameterName.MAX_COMPLETION_TOKENS,
                label="Max Tokens",
                default_value=UNSET,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="frequency_penalty",
                label="Frequency Penalty",
                default_value=UNSET,
                min_value=-2.0,
                max_value=2.0,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="presence_penalty",
                label="Presence Penalty",
                default_value=UNSET,
                min_value=-2.0,
                max_value=2.0,
            ),
            StringListInvocationParameter(
                invocation_name="stop",
                canonical_name=CanonicalParameterName.STOP_SEQUENCES,
                label="Stop Sequences",
                default_value=UNSET,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="top_p",
                canonical_name=CanonicalParameterName.TOP_P,
                label="Top P",
                default_value=UNSET,
                min_value=0.0,
                max_value=1.0,
            ),
            IntInvocationParameter(
                invocation_name="seed",
                canonical_name=CanonicalParameterName.RANDOM_SEED,
                label="Seed",
                default_value=UNSET,
            ),
            JSONInvocationParameter(
                invocation_name="tool_choice",
                label="Tool Choice",
                canonical_name=CanonicalParameterName.TOOL_CHOICE,
                default_value=UNSET,
                hidden=True,
            ),
            JSONInvocationParameter(
                invocation_name="response_format",
                label="Response Format",
                canonical_name=CanonicalParameterName.RESPONSE_FORMAT,
                default_value=UNSET,
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
        openai_messages = [self.to_openai_chat_completion_param(*message) for message in messages]
        tool_call_ids: dict[int, str] = {}
        token_usage: Optional["CompletionUsage"] = None
        async for chunk in await self.client.chat.completions.create(
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
        if token_usage is not None and self._set_span_attributes:
            self._set_span_attributes(dict(self._llm_token_counts(token_usage)))

    def to_openai_chat_completion_param(
        self,
        role: ChatCompletionMessageRole,
        content: JSONScalarType,
        tool_call_id: Optional[str] = None,
        tool_calls: Optional[list[JSONScalarType]] = None,
    ) -> "ChatCompletionMessageParam":
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
        "o1-preview",
        "o1-preview-2024-09-12",
        "o1-mini",
        "o1-mini-2024-09-12",
    ],
)
class OpenAIO1StreamingClient(OpenAIStreamingClient):
    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        return [
            IntInvocationParameter(
                invocation_name="max_completion_tokens",
                canonical_name=CanonicalParameterName.MAX_COMPLETION_TOKENS,
                label="Max Completion Tokens",
                default_value=UNSET,
            ),
            IntInvocationParameter(
                invocation_name="seed",
                canonical_name=CanonicalParameterName.RANDOM_SEED,
                label="Seed",
                default_value=UNSET,
            ),
            JSONInvocationParameter(
                invocation_name="tool_choice",
                label="Tool Choice",
                canonical_name=CanonicalParameterName.TOOL_CHOICE,
                default_value=UNSET,
                hidden=True,
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
        unfiltered_openai_messages = [
            self.to_openai_o1_chat_completion_param(*message) for message in messages
        ]

        # filter out unsupported messages
        openai_messages: list[ChatCompletionMessageParam] = [
            message for message in unfiltered_openai_messages if message is not None
        ]

        tool_call_ids: dict[int, str] = {}

        response = await self.client.chat.completions.create(
            messages=openai_messages,
            model=self.model_name,
            tools=tools or NOT_GIVEN,
            **invocation_parameters,
        )

        choice = response.choices[0]
        message = choice.message
        content = message.content

        text_chunk = TextChunk(content=content)
        yield text_chunk

        if (tool_calls := message.tool_calls) is not None:
            for tool_call_index, tool_call in enumerate(tool_calls):
                tool_call_id = (
                    tool_call.id
                    if tool_call.id is not None
                    else tool_call_ids.get(tool_call_index, f"tool_call_{tool_call_index}")
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

        if (usage := response.usage) is not None and self._set_span_attributes is not None:
            self._set_span_attributes(dict(self._llm_token_counts(usage)))

    def to_openai_o1_chat_completion_param(
        self,
        role: ChatCompletionMessageRole,
        content: JSONScalarType,
        tool_call_id: Optional[str] = None,
        tool_calls: Optional[list[JSONScalarType]] = None,
    ) -> Optional["ChatCompletionMessageParam"]:
        from openai.types.chat import (
            ChatCompletionAssistantMessageParam,
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
            return None  # System messages are not supported for o1 models
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
class AzureOpenAIStreamingClient(OpenAIStreamingClient):
    def __init__(
        self,
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
        set_span_attributes: Optional[SetSpanAttributesFn] = None,
    ):
        from openai import AsyncAzureOpenAI

        super().__init__(model=model, api_key=api_key, set_span_attributes=set_span_attributes)
        if model.endpoint is None or model.api_version is None:
            raise ValueError("endpoint and api_version are required for Azure OpenAI models")
        self.client = AsyncAzureOpenAI(
            api_key=api_key,
            azure_endpoint=model.endpoint,
            api_version=model.api_version,
        )


@register_llm_client(
    provider_key=GenerativeProviderKey.ANTHROPIC,
    model_names=[
        PROVIDER_DEFAULT,
        "claude-3-5-sonnet-20240620",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
    ],
)
class AnthropicStreamingClient(PlaygroundStreamingClient):
    def __init__(
        self,
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
        set_span_attributes: Optional[SetSpanAttributesFn] = None,
    ) -> None:
        import anthropic

        super().__init__(model=model, api_key=api_key, set_span_attributes=set_span_attributes)
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model_name = model.name

    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        return [
            IntInvocationParameter(
                invocation_name="max_tokens",
                canonical_name=CanonicalParameterName.MAX_COMPLETION_TOKENS,
                label="Max Tokens",
                default_value=UNSET,
                required=True,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="temperature",
                canonical_name=CanonicalParameterName.TEMPERATURE,
                label="Temperature",
                default_value=UNSET,
                min_value=0.0,
                max_value=1.0,
            ),
            StringListInvocationParameter(
                invocation_name="stop_sequences",
                canonical_name=CanonicalParameterName.STOP_SEQUENCES,
                label="Stop Sequences",
                default_value=UNSET,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="top_p",
                canonical_name=CanonicalParameterName.TOP_P,
                label="Top P",
                default_value=UNSET,
                min_value=0.0,
                max_value=1.0,
            ),
            JSONInvocationParameter(
                invocation_name="tool_choice",
                label="Tool Choice",
                canonical_name=CanonicalParameterName.TOOL_CHOICE,
                default_value=UNSET,
                hidden=True,
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
            "max_tokens": 1024,
            **invocation_parameters,
        }
        async with self.client.messages.stream(**anthropic_params) as stream:
            async for event in stream:
                if isinstance(event, anthropic_types.RawMessageStartEvent):
                    if self._set_span_attributes:
                        self._set_span_attributes(
                            {LLM_TOKEN_COUNT_PROMPT: event.message.usage.input_tokens}
                        )
                elif isinstance(event, anthropic_streaming.TextEvent):
                    yield TextChunk(content=event.text)
                elif isinstance(event, anthropic_streaming.MessageStopEvent):
                    if self._set_span_attributes:
                        self._set_span_attributes(
                            {LLM_TOKEN_COUNT_COMPLETION: event.message.usage.output_tokens}
                        )
                elif isinstance(
                    event,
                    (
                        anthropic_types.RawContentBlockStartEvent,
                        anthropic_types.RawContentBlockDeltaEvent,
                        anthropic_types.RawMessageDeltaEvent,
                        anthropic_streaming.ContentBlockStopEvent,
                    ),
                ):
                    # event types emitted by the stream that don't contain useful information
                    pass
                elif isinstance(event, anthropic_streaming.InputJsonEvent):
                    raise NotImplementedError
                else:
                    assert_never(event)

    def _build_anthropic_messages(
        self,
        messages: list[tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]]],
    ) -> tuple[list["MessageParam"], str]:
        anthropic_messages: list["MessageParam"] = []
        system_prompt = ""
        for role, content, _tool_call_id, _tool_calls in messages:
            if role == ChatCompletionMessageRole.USER:
                anthropic_messages.append({"role": "user", "content": content})
            elif role == ChatCompletionMessageRole.AI:
                anthropic_messages.append({"role": "assistant", "content": content})
            elif role == ChatCompletionMessageRole.SYSTEM:
                system_prompt += content + "\n"
            elif role == ChatCompletionMessageRole.TOOL:
                raise NotImplementedError
            else:
                assert_never(role)

        return anthropic_messages, system_prompt


class llm_span:
    """
    Creates an LLM span for a streaming chat completion.
    """

    def __init__(
        self,
        *,
        input: ChatCompletionInput,
        messages: list[ChatCompletionMessage],
        invocation_parameters: dict[str, Any],
        db: DbSessionFactory,
        attributes: Optional[dict[str, Any]] = None,
    ) -> None:
        self._input = input
        self._attributes: dict[str, Any] = attributes if attributes is not None else {}
        self._attributes.update(
            chain(
                _llm_span_kind(),
                _llm_model_name(input.model.name),
                _llm_tools(input.tools or []),
                _llm_input_messages(messages),
                _llm_invocation_parameters(invocation_parameters),
                _input_value_and_mime_type(input),
            )
        )
        self._db = db
        self._events: list[SpanEvent] = []
        self._start_time: datetime
        self._response_chunks: list[ChatCompletionChunk] = []
        self._text_chunks: list[TextChunk] = []
        self._tool_call_chunks: defaultdict[ToolCallID, list[ToolCallChunk]] = defaultdict(list)
        self._finished_chat_completion: FinishedChatCompletion
        self._project_id: int

    async def __aenter__(self) -> Self:
        self._start_time = cast(datetime, normalize_datetime(dt=local_now(), tz=timezone.utc))
        return self

    async def __aexit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc_value: Optional[BaseException],
        traceback: Optional[TracebackType],
    ) -> bool:
        end_time = cast(datetime, normalize_datetime(dt=local_now(), tz=timezone.utc))
        status_code = StatusCode.OK
        status_message = ""
        if exc_type is not None:
            status_code = StatusCode.ERROR
            status_message = str(exc_value)
            self._events.append(
                SpanException(
                    timestamp=end_time,
                    message=status_message,
                    exception_type=type(exc_value).__name__,
                    exception_escaped=False,
                    exception_stacktrace=format_exc(),
                )
            )
        if self._response_chunks:
            self._attributes.update(
                chain(
                    _output_value_and_mime_type(self._response_chunks),
                    _llm_output_messages(self._text_chunks, self._tool_call_chunks),
                )
            )
        prompt_tokens = self._attributes.get(LLM_TOKEN_COUNT_PROMPT, 0)
        completion_tokens = self._attributes.get(LLM_TOKEN_COUNT_COMPLETION, 0)
        trace_id = _generate_trace_id()
        span_id = _generate_span_id()
        async with self._db() as session:
            if (
                project_id := await session.scalar(
                    select(models.Project.id).where(models.Project.name == PLAYGROUND_PROJECT_NAME)
                )
            ) is None:
                project_id = await session.scalar(
                    insert(models.Project)
                    .returning(models.Project.id)
                    .values(
                        name=PLAYGROUND_PROJECT_NAME,
                        description="Traces from prompt playground",
                    )
                )
            trace = models.Trace(
                project_rowid=project_id,
                trace_id=trace_id,
                start_time=self._start_time,
                end_time=end_time,
            )
            span = models.Span(
                trace_rowid=trace.id,
                span_id=span_id,
                parent_id=None,
                name="ChatCompletion",
                span_kind=LLM,
                start_time=self._start_time,
                end_time=end_time,
                attributes=unflatten(self._attributes.items()),
                events=[_serialize_event(event) for event in self._events],
                status_code=status_code.name,
                status_message=status_message,
                cumulative_error_count=int(status_code is StatusCode.ERROR),
                cumulative_llm_token_count_prompt=prompt_tokens,
                cumulative_llm_token_count_completion=completion_tokens,
                llm_token_count_prompt=prompt_tokens,
                llm_token_count_completion=completion_tokens,
                trace=trace,
            )
            session.add(trace)
            session.add(span)
            await session.flush()
        self._project_id = project_id
        self._finished_chat_completion = FinishedChatCompletion(
            span=to_gql_span(span),
            error_message=status_message if status_code is StatusCode.ERROR else None,
        )
        return True

    def set_attributes(self, attributes: Mapping[str, Any]) -> None:
        self._attributes.update(attributes)

    def add_response_chunk(self, chunk: ChatCompletionChunk) -> None:
        self._response_chunks.append(chunk)
        if isinstance(chunk, TextChunk):
            self._text_chunks.append(chunk)
        elif isinstance(chunk, ToolCallChunk):
            self._tool_call_chunks[chunk.id].append(chunk)
        else:
            assert_never(chunk)

    @property
    def finished_chat_completion(self) -> FinishedChatCompletion:
        return self._finished_chat_completion

    @property
    def project_id(self) -> int:
        return self._project_id


@strawberry.type
class Subscription:
    @strawberry.subscription
    async def chat_completion(
        self, info: Info[Context, None], input: ChatCompletionInput
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        provider_key = input.model.provider_key
        llm_client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(provider_key, input.model.name)
        if llm_client_class is None:
            raise BadRequest(f"No LLM client registered for provider '{provider_key}'")
        attributes: dict[str, Any] = {}
        llm_client = llm_client_class(
            model=input.model,
            api_key=input.api_key,
            set_span_attributes=lambda attrs: attributes.update(attrs),
        )

        messages = [
            (
                message.role,
                message.content,
                message.tool_call_id if isinstance(message.tool_call_id, str) else None,
                message.tool_calls if isinstance(message.tool_calls, list) else None,
            )
            for message in input.messages
        ]
        if template_options := input.template:
            messages = list(_formatted_messages(messages, template_options))
        invocation_parameters = llm_client.construct_invocation_parameters(
            input.invocation_parameters
        )
        async with llm_span(
            input=input,
            messages=messages,
            invocation_parameters=invocation_parameters,
            db=info.context.db,
            attributes=attributes,
        ) as span:
            async for chunk in llm_client.chat_completion_create(
                messages=messages, tools=input.tools or [], **invocation_parameters
            ):
                span.add_response_chunk(chunk)
                yield chunk
        yield span.finished_chat_completion
        info.context.event_queue.put(SpanInsertEvent(ids=(span.project_id,)))


def _llm_span_kind() -> Iterator[tuple[str, Any]]:
    yield OPENINFERENCE_SPAN_KIND, LLM


def _llm_model_name(model_name: str) -> Iterator[tuple[str, Any]]:
    yield LLM_MODEL_NAME, model_name


def _llm_invocation_parameters(invocation_parameters: dict[str, Any]) -> Iterator[tuple[str, Any]]:
    yield LLM_INVOCATION_PARAMETERS, safe_json_dumps(invocation_parameters)


def _llm_tools(tools: list[JSONScalarType]) -> Iterator[tuple[str, Any]]:
    for tool_index, tool in enumerate(tools):
        yield f"{LLM_TOOLS}.{tool_index}.{TOOL_JSON_SCHEMA}", json.dumps(tool)


def _input_value_and_mime_type(input: ChatCompletionInput) -> Iterator[tuple[str, Any]]:
    assert (api_key := "api_key") in (input_data := jsonify(input))
    disallowed_keys = {"api_key", "invocation_parameters"}
    input_data = {k: v for k, v in input_data.items() if k not in disallowed_keys}
    assert api_key not in input_data
    yield INPUT_MIME_TYPE, JSON
    yield INPUT_VALUE, safe_json_dumps(input_data)


def _output_value_and_mime_type(output: Any) -> Iterator[tuple[str, Any]]:
    yield OUTPUT_MIME_TYPE, JSON
    yield OUTPUT_VALUE, safe_json_dumps(jsonify(output))


def _llm_input_messages(
    messages: Iterable[
        tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
    ],
) -> Iterator[tuple[str, Any]]:
    for i, (role, content, _tool_call_id, tool_calls) in enumerate(messages):
        yield f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_ROLE}", role.value.lower()
        yield f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_CONTENT}", content
        if tool_calls is not None:
            for tool_call_index, tool_call in enumerate(tool_calls):
                yield (
                    f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_NAME}",
                    tool_call["function"]["name"],
                )
                if arguments := tool_call["function"]["arguments"]:
                    yield (
                        f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}",
                        safe_json_dumps(jsonify(arguments)),
                    )


def _llm_output_messages(
    text_chunks: list[TextChunk],
    tool_call_chunks: defaultdict[ToolCallID, list[ToolCallChunk]],
) -> Iterator[tuple[str, Any]]:
    yield f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"
    if content := "".join(chunk.content for chunk in text_chunks):
        yield f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", content
    for tool_call_index, (_tool_call_id, tool_call_chunks_) in enumerate(tool_call_chunks.items()):
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


def _generate_trace_id() -> str:
    """
    Generates a random trace ID in hexadecimal format.
    """
    return _hex(DefaultOTelIDGenerator().generate_trace_id())


def _generate_span_id() -> str:
    """
    Generates a random span ID in hexadecimal format.
    """
    return _hex(DefaultOTelIDGenerator().generate_span_id())


def _hex(number: int) -> str:
    """
    Converts an integer to a hexadecimal string.
    """
    return hex(number)[2:]


def _formatted_messages(
    messages: Iterable[ChatCompletionMessage],
    template_options: TemplateOptions,
) -> Iterator[tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]]]:
    """
    Formats the messages using the given template options.
    """
    template_formatter = _template_formatter(template_language=template_options.language)
    (
        roles,
        templates,
        tool_call_id,
        tool_calls,
    ) = zip(*messages)
    formatted_templates = map(
        lambda template: template_formatter.format(template, **template_options.variables),
        templates,
    )
    formatted_messages = zip(roles, formatted_templates, tool_call_id, tool_calls)
    return formatted_messages


def _template_formatter(template_language: TemplateLanguage) -> TemplateFormatter:
    """
    Instantiates the appropriate template formatter for the template language.
    """
    if template_language is TemplateLanguage.MUSTACHE:
        return MustacheTemplateFormatter()
    if template_language is TemplateLanguage.F_STRING:
        return FStringTemplateFormatter()
    assert_never(template_language)


def _serialize_event(event: SpanEvent) -> dict[str, Any]:
    """
    Serializes a SpanEvent to a dictionary.
    """
    return {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in asdict(event).items()}


JSON = OpenInferenceMimeTypeValues.JSON.value

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
LLM_TOKEN_COUNT_TOTAL = SpanAttributes.LLM_TOKEN_COUNT_TOTAL

MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE
MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS

TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
TOOL_CALL_FUNCTION_ARGUMENTS_JSON = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON

TOOL_JSON_SCHEMA = ToolAttributes.TOOL_JSON_SCHEMA
