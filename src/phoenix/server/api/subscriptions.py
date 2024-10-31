import json
from collections import defaultdict
from collections.abc import AsyncIterator, Iterable, Iterator, Mapping
from dataclasses import asdict
from datetime import datetime, timezone
from itertools import chain
from traceback import format_exc
from types import TracebackType
from typing import (
    Any,
    Optional,
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
from strawberry.scalars import JSON as JSONScalarType
from strawberry.types import Info
from typing_extensions import Self, TypeAlias, assert_never

import phoenix.server.api.llm_clients  # noqa F401
from phoenix.datetime_utils import local_now, normalize_datetime
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.playground_registry import (
    PLAYGROUND_CLIENT_REGISTRY,
)
from phoenix.server.api.input_types.ChatCompletionInput import ChatCompletionInput
from phoenix.server.api.input_types.TemplateOptions import TemplateOptions
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionPayload,
    FinishedChatCompletion,
    TextChunk,
    ToolCallChunk,
)
from phoenix.server.api.types.Span import to_gql_span
from phoenix.server.api.types.TemplateLanguage import TemplateLanguage
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

PLAYGROUND_PROJECT_NAME = "playground"

ChatCompletionMessage: TypeAlias = tuple[
    ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]
]
ToolCallID: TypeAlias = str


class streaming_llm_span:
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
        self._response_chunks: list[Union[TextChunk, ToolCallChunk]] = []
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

    def add_response_chunk(self, chunk: Union[TextChunk, ToolCallChunk]) -> None:
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
        async with streaming_llm_span(
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

MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE
MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS

TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
TOOL_CALL_FUNCTION_ARGUMENTS_JSON = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON

TOOL_JSON_SCHEMA = ToolAttributes.TOOL_JSON_SCHEMA
