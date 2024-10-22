import json
from abc import ABC, abstractmethod
from collections import defaultdict
from datetime import datetime, timezone
from enum import Enum
from itertools import chain
from typing import (
    TYPE_CHECKING,
    Annotated,
    Any,
    AsyncIterator,
    Callable,
    DefaultDict,
    Dict,
    Iterable,
    Iterator,
    List,
    Optional,
    Tuple,
    Type,
    Union,
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
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode
from sqlalchemy import insert, select
from strawberry import UNSET
from strawberry.scalars import JSON as JSONScalarType
from strawberry.types import Info
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.ChatCompletionMessageInput import ChatCompletionMessageInput
from phoenix.server.api.input_types.InvocationParameters import InvocationParameters
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.Span import Span, to_gql_span
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.trace.attributes import unflatten
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

ToolCallID: TypeAlias = str


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
    messages: List[ChatCompletionMessageInput]
    model: GenerativeModelInput
    invocation_parameters: InvocationParameters
    tools: Optional[List[JSONScalarType]] = UNSET
    template: Optional[TemplateOptions] = UNSET
    api_key: Optional[str] = strawberry.field(default=None)


PLAYGROUND_STREAMING_CLIENT_REGISTRY: Dict[
    GenerativeProviderKey, Type["PlaygroundStreamingClient"]
] = {}


def register_llm_client(
    provider_key: GenerativeProviderKey,
) -> Callable[[Type["PlaygroundStreamingClient"]], Type["PlaygroundStreamingClient"]]:
    def decorator(cls: Type["PlaygroundStreamingClient"]) -> Type["PlaygroundStreamingClient"]:
        PLAYGROUND_STREAMING_CLIENT_REGISTRY[provider_key] = cls
        return cls

    return decorator


class PlaygroundStreamingClient(ABC):
    def __init__(self, model: GenerativeModelInput, api_key: Optional[str] = None) -> None: ...

    @abstractmethod
    async def chat_completion_create(
        self,
        messages: List[
            Tuple[ChatCompletionMessageRole, str, Optional[str], Optional[List[JSONScalarType]]]
        ],
        tools: List[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        # a yield statement is needed to satisfy the type-checker
        # https://mypy.readthedocs.io/en/stable/more_types.html#asynchronous-iterators
        yield TextChunk(content="")

    @property
    @abstractmethod
    def attributes(self) -> Dict[str, Any]: ...


@register_llm_client(GenerativeProviderKey.OPENAI)
class OpenAIStreamingClient(PlaygroundStreamingClient):
    def __init__(self, model: GenerativeModelInput, api_key: Optional[str] = None) -> None:
        from openai import AsyncOpenAI

        self.client = AsyncOpenAI(api_key=api_key)
        self.model_name = model.name
        self._attributes: Dict[str, Any] = {}

    async def chat_completion_create(
        self,
        messages: List[
            Tuple[ChatCompletionMessageRole, str, Optional[str], Optional[List[JSONScalarType]]]
        ],
        tools: List[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        from openai import NOT_GIVEN
        from openai.types.chat import ChatCompletionStreamOptionsParam

        # Convert standard messages to OpenAI messages
        openai_messages = [self.to_openai_chat_completion_param(*message) for message in messages]
        tool_call_ids: Dict[int, str] = {}
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
        if token_usage is not None:
            self._attributes.update(_llm_token_counts(token_usage))

    def to_openai_chat_completion_param(
        self,
        role: ChatCompletionMessageRole,
        content: JSONScalarType,
        tool_call_id: Optional[str] = None,
        tool_calls: Optional[List[JSONScalarType]] = None,
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

    @property
    def attributes(self) -> Dict[str, Any]:
        return self._attributes


@register_llm_client(GenerativeProviderKey.AZURE_OPENAI)
class AzureOpenAIStreamingClient(OpenAIStreamingClient):
    def __init__(self, model: GenerativeModelInput, api_key: Optional[str] = None):
        from openai import AsyncAzureOpenAI

        if model.endpoint is None or model.api_version is None:
            raise ValueError("endpoint and api_version are required for Azure OpenAI models")
        self.client = AsyncAzureOpenAI(
            api_key=api_key,
            azure_endpoint=model.endpoint,
            api_version=model.api_version,
        )


@register_llm_client(GenerativeProviderKey.ANTHROPIC)
class AnthropicStreamingClient(PlaygroundStreamingClient):
    def __init__(self, model: GenerativeModelInput, api_key: Optional[str] = None) -> None:
        import anthropic

        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model_name = model.name

    async def chat_completion_create(
        self,
        messages: List[
            Tuple[ChatCompletionMessageRole, str, Optional[str], Optional[List[JSONScalarType]]]
        ],
        tools: List[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        anthropic_messages, system_prompt = self._build_anthropic_messages(messages)

        anthropic_params = {
            "messages": anthropic_messages,
            "model": self.model_name,
            "system": system_prompt,
            "max_tokens": 1024,
            **invocation_parameters,
        }

        async with self.client.messages.stream(**anthropic_params) as stream:
            async for text in stream.text_stream:
                yield TextChunk(content=text)

    def _build_anthropic_messages(
        self,
        messages: List[Tuple[ChatCompletionMessageRole, str, Optional[str], Optional[List[str]]]],
    ) -> Tuple[List["MessageParam"], str]:
        anthropic_messages: List["MessageParam"] = []
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

    @property
    def attributes(self) -> Dict[str, Any]:
        return dict()


@strawberry.type
class Subscription:
    @strawberry.subscription
    async def chat_completion(
        self, info: Info[Context, None], input: ChatCompletionInput
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        # Determine which LLM client to use based on provider_key
        provider_key = input.model.provider_key
        llm_client_class = PLAYGROUND_STREAMING_CLIENT_REGISTRY.get(provider_key)
        if llm_client_class is None:
            raise ValueError(f"No LLM client registered for provider '{provider_key}'")

        llm_client = llm_client_class(model=input.model, api_key=input.api_key)

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

        invocation_parameters = jsonify(input.invocation_parameters)

        in_memory_span_exporter = InMemorySpanExporter()
        tracer_provider = TracerProvider()
        tracer_provider.add_span_processor(
            span_processor=SimpleSpanProcessor(span_exporter=in_memory_span_exporter)
        )
        tracer = tracer_provider.get_tracer(__name__)
        span_name = "ChatCompletion"
        with tracer.start_span(
            span_name,
            attributes=dict(
                chain(
                    _llm_span_kind(),
                    _llm_model_name(input.model.name),
                    _llm_tools(input.tools or []),
                    _llm_input_messages(messages),
                    _llm_invocation_parameters(invocation_parameters),
                    _input_value_and_mime_type(input),
                )
            ),
        ) as span:
            response_chunks = []
            text_chunks: List[TextChunk] = []
            tool_call_chunks: DefaultDict[ToolCallID, List[ToolCallChunk]] = defaultdict(list)

            async for chunk in llm_client.chat_completion_create(
                messages=messages,
                tools=input.tools or [],
                **invocation_parameters,
            ):
                response_chunks.append(chunk)
                if isinstance(chunk, TextChunk):
                    yield chunk
                    text_chunks.append(chunk)
                elif isinstance(chunk, ToolCallChunk):
                    yield chunk
                    tool_call_chunks[chunk.id].append(chunk)

            span.set_status(StatusCode.OK)
            llm_client_attributes = llm_client.attributes

            span.set_attributes(
                dict(
                    chain(
                        _output_value_and_mime_type(response_chunks),
                        llm_client_attributes.items(),
                        _llm_output_messages(text_chunks, tool_call_chunks),
                    )
                )
            )
        assert len(spans := in_memory_span_exporter.get_finished_spans()) == 1
        finished_span = spans[0]
        assert finished_span.start_time is not None
        assert finished_span.end_time is not None
        assert (attributes := finished_span.attributes) is not None
        start_time = _datetime(epoch_nanoseconds=finished_span.start_time)
        end_time = _datetime(epoch_nanoseconds=finished_span.end_time)
        prompt_tokens = llm_client_attributes.get(LLM_TOKEN_COUNT_PROMPT, 0)
        completion_tokens = llm_client_attributes.get(LLM_TOKEN_COUNT_COMPLETION, 0)
        trace_id = _hex(finished_span.context.trace_id)
        span_id = _hex(finished_span.context.span_id)
        status = finished_span.status
        async with info.context.db() as session:
            if (
                playground_project_id := await session.scalar(
                    select(models.Project.id).where(models.Project.name == PLAYGROUND_PROJECT_NAME)
                )
            ) is None:
                playground_project_id = await session.scalar(
                    insert(models.Project)
                    .returning(models.Project.id)
                    .values(
                        name=PLAYGROUND_PROJECT_NAME,
                        description="Traces from prompt playground",
                    )
                )
            playground_trace = models.Trace(
                project_rowid=playground_project_id,
                trace_id=trace_id,
                start_time=start_time,
                end_time=end_time,
            )
            playground_span = models.Span(
                trace_rowid=playground_trace.id,
                span_id=span_id,
                parent_id=None,
                name=span_name,
                span_kind=LLM,
                start_time=start_time,
                end_time=end_time,
                attributes=unflatten(attributes.items()),
                events=finished_span.events,
                status_code=status.status_code.name,
                status_message=status.description or "",
                cumulative_error_count=int(not status.is_ok),
                cumulative_llm_token_count_prompt=prompt_tokens,
                cumulative_llm_token_count_completion=completion_tokens,
                llm_token_count_prompt=prompt_tokens,
                llm_token_count_completion=completion_tokens,
                trace=playground_trace,
            )
            session.add(playground_trace)
            session.add(playground_span)
            await session.flush()
            yield FinishedChatCompletion(span=to_gql_span(playground_span))
        info.context.event_queue.put(SpanInsertEvent(ids=(playground_project_id,)))


def _llm_span_kind() -> Iterator[Tuple[str, Any]]:
    yield OPENINFERENCE_SPAN_KIND, LLM


def _llm_model_name(model_name: str) -> Iterator[Tuple[str, Any]]:
    yield LLM_MODEL_NAME, model_name


def _llm_invocation_parameters(invocation_parameters: Dict[str, Any]) -> Iterator[Tuple[str, Any]]:
    yield LLM_INVOCATION_PARAMETERS, safe_json_dumps(invocation_parameters)


def _llm_tools(tools: List[JSONScalarType]) -> Iterator[Tuple[str, Any]]:
    for tool_index, tool in enumerate(tools):
        yield f"{LLM_TOOLS}.{tool_index}.{TOOL_JSON_SCHEMA}", json.dumps(tool)


def _llm_token_counts(usage: "CompletionUsage") -> Iterator[Tuple[str, Any]]:
    yield LLM_TOKEN_COUNT_PROMPT, usage.prompt_tokens
    yield LLM_TOKEN_COUNT_COMPLETION, usage.completion_tokens
    yield LLM_TOKEN_COUNT_TOTAL, usage.total_tokens


def _input_value_and_mime_type(input: ChatCompletionInput) -> Iterator[Tuple[str, Any]]:
    assert (api_key := "api_key") in (input_data := jsonify(input))
    input_data = {k: v for k, v in input_data.items() if k != api_key}
    assert api_key not in input_data
    yield INPUT_MIME_TYPE, JSON
    yield INPUT_VALUE, safe_json_dumps(input_data)


def _output_value_and_mime_type(output: Any) -> Iterator[Tuple[str, Any]]:
    yield OUTPUT_MIME_TYPE, JSON
    yield OUTPUT_VALUE, safe_json_dumps(jsonify(output))


def _llm_input_messages(
    messages: Iterable[
        Tuple[ChatCompletionMessageRole, str, Optional[str], Optional[List[JSONScalarType]]]
    ],
) -> Iterator[Tuple[str, Any]]:
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
    text_chunks: List[TextChunk],
    tool_call_chunks: DefaultDict[ToolCallID, List[ToolCallChunk]],
) -> Iterator[Tuple[str, Any]]:
    yield f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"
    if content := "".join(chunk.content for chunk in text_chunks):
        yield f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", content
    for tool_call_index, tool_call_chunks_ in tool_call_chunks.items():
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


def _hex(number: int) -> str:
    """
    Converts an integer to a hexadecimal string.
    """
    return hex(number)[2:]


def _datetime(*, epoch_nanoseconds: float) -> datetime:
    """
    Converts a Unix epoch timestamp in nanoseconds to a datetime.
    """
    epoch_seconds = epoch_nanoseconds / 1e9
    return datetime.fromtimestamp(epoch_seconds).replace(tzinfo=timezone.utc)


def _formatted_messages(
    messages: Iterable[Tuple[ChatCompletionMessageRole, str, Optional[str], Optional[List[str]]]],
    template_options: TemplateOptions,
) -> Iterator[Tuple[ChatCompletionMessageRole, str, Optional[str], Optional[List[str]]]]:
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
