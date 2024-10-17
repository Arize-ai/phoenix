import json
from collections import defaultdict
from dataclasses import fields
from datetime import datetime
from enum import Enum
from itertools import chain
from typing import (
    TYPE_CHECKING,
    Annotated,
    Any,
    AsyncIterator,
    DefaultDict,
    Dict,
    Iterator,
    List,
    Optional,
    Tuple,
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
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.trace.attributes import unflatten
from phoenix.utilities.json import jsonify

if TYPE_CHECKING:
    from openai.types.chat import (
        ChatCompletionMessageParam,
    )

PLAYGROUND_PROJECT_NAME = "playground"

ToolCallIndex: TypeAlias = int


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


ChatCompletionChunk: TypeAlias = Annotated[
    Union[TextChunk, ToolCallChunk], strawberry.union("ChatCompletionChunk")
]


@strawberry.input
class GenerativeModelInput:
    provider_key: GenerativeProviderKey
    name: str


@strawberry.input
class ChatCompletionInput:
    messages: List[ChatCompletionMessageInput]
    model: GenerativeModelInput
    invocation_parameters: InvocationParameters
    tools: Optional[List[JSONScalarType]] = UNSET
    template: Optional[TemplateOptions] = UNSET
    api_key: Optional[str] = strawberry.field(default=None)


def to_openai_chat_completion_param(
    message: ChatCompletionMessageInput,
) -> "ChatCompletionMessageParam":
    from openai.types.chat import (
        ChatCompletionAssistantMessageParam,
        ChatCompletionSystemMessageParam,
        ChatCompletionUserMessageParam,
    )

    if message.role is ChatCompletionMessageRole.USER:
        return ChatCompletionUserMessageParam(
            {
                "content": message.content,
                "role": "user",
            }
        )
    if message.role is ChatCompletionMessageRole.SYSTEM:
        return ChatCompletionSystemMessageParam(
            {
                "content": message.content,
                "role": "system",
            }
        )
    if message.role is ChatCompletionMessageRole.AI:
        return ChatCompletionAssistantMessageParam(
            {
                "content": message.content,
                "role": "assistant",
            }
        )
    if message.role is ChatCompletionMessageRole.TOOL:
        raise NotImplementedError
    assert_never(message.role)


@strawberry.type
class Subscription:
    @strawberry.subscription
    async def chat_completion(
        self, info: Info[Context, None], input: ChatCompletionInput
    ) -> AsyncIterator[ChatCompletionChunk]:
        from openai import NOT_GIVEN, AsyncOpenAI

        client = AsyncOpenAI(api_key=input.api_key)
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
                    _llm_input_messages(input.messages),
                    _llm_invocation_parameters(invocation_parameters),
                    _input_value_and_mime_type(input),
                )
            ),
        ) as span:
            response_chunks = []
            text_chunks: List[TextChunk] = []
            tool_call_chunks: DefaultDict[ToolCallIndex, List[ToolCallChunk]] = defaultdict(list)
            role: Optional[str] = None
            async for chunk in await client.chat.completions.create(
                messages=(to_openai_chat_completion_param(message) for message in input.messages),
                model=input.model.name,
                stream=True,
                tools=input.tools or NOT_GIVEN,
                **invocation_parameters,
            ):
                response_chunks.append(chunk)
                choice = chunk.choices[0]
                delta = choice.delta
                if role is None:
                    role = delta.role
                if choice.finish_reason is None:
                    if isinstance(chunk_content := delta.content, str):
                        text_chunk = TextChunk(content=chunk_content)
                        yield text_chunk
                        text_chunks.append(text_chunk)
                    if (tool_calls := delta.tool_calls) is not None:
                        for tool_call_index, tool_call in enumerate(tool_calls):
                            if (function := tool_call.function) is not None:
                                if (tool_call_id := tool_call.id) is None:
                                    first_tool_call_chunk = tool_call_chunks[tool_call_index][0]
                                    tool_call_id = first_tool_call_chunk.id
                                tool_call_chunk = ToolCallChunk(
                                    id=tool_call_id,
                                    function=FunctionCallChunk(
                                        name=function.name or "",
                                        arguments=function.arguments or "",
                                    ),
                                )
                                yield tool_call_chunk
                                tool_call_chunks[tool_call_index].append(tool_call_chunk)
            span.set_status(StatusCode.OK)
            assert role is not None
            span.set_attributes(
                dict(
                    chain(
                        _output_value_and_mime_type(response_chunks),
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
            trace_rowid = await session.scalar(
                insert(models.Trace)
                .returning(models.Trace.id)
                .values(
                    project_rowid=playground_project_id,
                    trace_id=trace_id,
                    start_time=start_time,
                    end_time=end_time,
                )
            )
            await session.execute(
                insert(models.Span).values(
                    trace_rowid=trace_rowid,
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
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                    llm_token_count_prompt=0,
                    llm_token_count_completion=0,
                )
            )
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


def _input_value_and_mime_type(input: ChatCompletionInput) -> Iterator[Tuple[str, Any]]:
    assert any(field.name == (api_key := "api_key") for field in fields(ChatCompletionInput))
    yield INPUT_MIME_TYPE, JSON
    yield INPUT_VALUE, safe_json_dumps({k: v for k, v in jsonify(input).items() if k != api_key})


def _output_value_and_mime_type(output: Any) -> Iterator[Tuple[str, Any]]:
    yield OUTPUT_MIME_TYPE, JSON
    yield OUTPUT_VALUE, safe_json_dumps(jsonify(output))


def _llm_input_messages(messages: List[ChatCompletionMessageInput]) -> Iterator[Tuple[str, Any]]:
    for i, message in enumerate(messages):
        yield f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_ROLE}", message.role.value.lower()
        yield f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_CONTENT}", message.content


def _llm_output_messages(
    text_chunks: List[TextChunk],
    tool_call_chunks: DefaultDict[ToolCallIndex, List[ToolCallChunk]],
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
    return datetime.fromtimestamp(epoch_seconds)


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

MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE
MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS

TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
TOOL_CALL_FUNCTION_ARGUMENTS_JSON = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON

TOOL_JSON_SCHEMA = ToolAttributes.TOOL_JSON_SCHEMA
