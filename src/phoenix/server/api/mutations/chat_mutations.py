import json
from dataclasses import asdict
from datetime import datetime, timezone
from itertools import chain
from traceback import format_exc
from typing import Any, Iterable, Iterator, List, Optional

import strawberry
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
from strawberry.types import Info
from typing_extensions import assert_never

from phoenix.datetime_utils import local_now, normalize_datetime
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.playground_clients import initialize_playground_clients
from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY
from phoenix.server.api.input_types.ChatCompletionInput import ChatCompletionInput
from phoenix.server.api.input_types.TemplateOptions import TemplateOptions
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    TextChunk,
    ToolCallChunk,
)
from phoenix.server.api.types.Span import Span, to_gql_span
from phoenix.server.api.types.TemplateLanguage import TemplateLanguage
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.trace.attributes import unflatten
from phoenix.trace.schemas import SpanException
from phoenix.utilities.template_formatters import (
    FStringTemplateFormatter,
    MustacheTemplateFormatter,
    TemplateFormatter,
)

initialize_playground_clients()

ChatCompletionMessage = tuple[ChatCompletionMessageRole, str, Optional[str], Optional[List[Any]]]


@strawberry.type
class ChatCompletionFunctionCall:
    name: str
    arguments: str


@strawberry.type
class ChatCompletionToolCall:
    id: str
    function: ChatCompletionFunctionCall


@strawberry.type
class ChatCompletionMutationPayload:
    content: Optional[str]
    tool_calls: List[ChatCompletionToolCall]
    span: Span
    error_message: Optional[str]


@strawberry.type
class ChatCompletionMutationMixin:
    @strawberry.mutation
    async def chat_completion(
        self, info: Info[Context, None], input: ChatCompletionInput
    ) -> ChatCompletionMutationPayload:
        provider_key = input.model.provider_key
        llm_client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(provider_key, input.model.name)
        if llm_client_class is None:
            raise BadRequest(f"No LLM client registered for provider '{provider_key}'")
        attributes: dict[str, Any] = {}
        llm_client = llm_client_class(
            model=input.model,
            api_key=input.api_key,
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

        text_content = ""
        tool_calls = []
        events = []
        attributes.update(
            chain(
                _llm_span_kind(),
                _llm_model_name(input.model.name),
                _llm_tools(input.tools or []),
                _llm_input_messages(messages),
                _llm_invocation_parameters(invocation_parameters),
                _input_value_and_mime_type(input),
                **llm_client.attributes,
            )
        )

        start_time = normalize_datetime(dt=local_now(), tz=timezone.utc)
        status_code = StatusCode.OK
        status_message = ""
        try:
            async for chunk in llm_client.chat_completion_create(
                messages=messages, tools=input.tools or [], **invocation_parameters
            ):
                # Process the chunk
                if isinstance(chunk, TextChunk):
                    text_content += chunk.content
                elif isinstance(chunk, ToolCallChunk):
                    tool_call = ChatCompletionToolCall(
                        id=chunk.id,
                        function=ChatCompletionFunctionCall(
                            name=chunk.function.name,
                            arguments=chunk.function.arguments,
                        ),
                    )
                    tool_calls.append(tool_call)
                else:
                    assert_never(chunk)
        except Exception as e:
            # Handle exceptions and record exception event
            status_code = StatusCode.ERROR
            status_message = str(e)
            end_time = normalize_datetime(dt=local_now(), tz=timezone.utc)
            assert end_time is not None
            events.append(
                SpanException(
                    timestamp=end_time,
                    message=status_message,
                    exception_type=type(e).__name__,
                    exception_escaped=False,
                    exception_stacktrace=format_exc(),
                )
            )
        else:
            end_time = normalize_datetime(dt=local_now(), tz=timezone.utc)

        if text_content or tool_calls:
            attributes.update(
                chain(
                    _output_value_and_mime_type({"text": text_content, "tool_calls": tool_calls}),
                    _llm_output_messages(text_content, tool_calls),
                )
            )

        # Now write the span to the database
        trace_id = _generate_trace_id()
        span_id = _generate_span_id()
        async with info.context.db() as session:
            # Get or create the project ID
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
                start_time=start_time,
                end_time=end_time,
            )
            span = models.Span(
                trace_rowid=trace.id,
                span_id=span_id,
                parent_id=None,
                name="ChatCompletion",
                span_kind=LLM,
                start_time=start_time,
                end_time=end_time,
                attributes=unflatten(attributes.items()),
                events=[_serialize_event(event) for event in events],
                status_code=status_code.name,
                status_message=status_message,
                cumulative_error_count=int(status_code is StatusCode.ERROR),
                cumulative_llm_token_count_prompt=attributes.get(LLM_TOKEN_COUNT_PROMPT, 0),
                cumulative_llm_token_count_completion=attributes.get(LLM_TOKEN_COUNT_COMPLETION, 0),
                llm_token_count_prompt=attributes.get(LLM_TOKEN_COUNT_PROMPT, 0),
                llm_token_count_completion=attributes.get(LLM_TOKEN_COUNT_COMPLETION, 0),
                trace=trace,
            )
            session.add(trace)
            session.add(span)
            await session.flush()

        gql_span = to_gql_span(span)

        info.context.event_queue.put(SpanInsertEvent(ids=(project_id,)))

        if status_code is StatusCode.ERROR:
            return ChatCompletionMutationPayload(
                content=None,
                tool_calls=[],
                span=gql_span,
                error_message=status_message,
            )
        else:
            return ChatCompletionMutationPayload(
                content=text_content if text_content else None,
                tool_calls=tool_calls,
                span=gql_span,
                error_message=None,
            )


def _formatted_messages(
    messages: Iterable[ChatCompletionMessage],
    template_options: TemplateOptions,
) -> Iterator[ChatCompletionMessage]:
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


def _llm_span_kind() -> Iterator[tuple[str, Any]]:
    yield OPENINFERENCE_SPAN_KIND, LLM


def _llm_model_name(model_name: str) -> Iterator[tuple[str, Any]]:
    yield LLM_MODEL_NAME, model_name


def _llm_invocation_parameters(invocation_parameters: dict[str, Any]) -> Iterator[tuple[str, Any]]:
    yield LLM_INVOCATION_PARAMETERS, json.dumps(invocation_parameters)


def _llm_tools(tools: List[Any]) -> Iterator[tuple[str, Any]]:
    for tool_index, tool in enumerate(tools):
        yield f"{LLM_TOOLS}.{tool_index}.{TOOL_JSON_SCHEMA}", json.dumps(tool)


def _input_value_and_mime_type(input: ChatCompletionInput) -> Iterator[tuple[str, Any]]:
    input_data = input.__dict__.copy()
    input_data.pop("api_key", None)
    yield INPUT_MIME_TYPE, JSON
    yield INPUT_VALUE, json.dumps(input_data)


def _output_value_and_mime_type(output: Any) -> Iterator[tuple[str, Any]]:
    yield OUTPUT_MIME_TYPE, JSON
    yield OUTPUT_VALUE, json.dumps(output)


def _llm_input_messages(
    messages: Iterable[ChatCompletionMessage],
) -> Iterator[tuple[str, Any]]:
    for i, (role, content, _tool_call_id, tool_calls) in enumerate(messages):
        yield f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_ROLE}", role.value.lower()
        yield f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_CONTENT}", content
        if tool_calls:
            for tool_call_index, tool_call in enumerate(tool_calls):
                yield (
                    f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_NAME}",
                    tool_call["function"]["name"],
                )
                if arguments := tool_call["function"]["arguments"]:
                    yield (
                        f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}",
                        json.dumps(arguments),
                    )


def _llm_output_messages(
    text_content: str, tool_calls: List[ChatCompletionToolCall]
) -> Iterator[tuple[str, Any]]:
    yield f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"
    if text_content:
        yield f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", text_content
    for tool_call_index, tool_call in enumerate(tool_calls):
        yield (
            f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_NAME}",
            tool_call.function.name,
        )
        if arguments := tool_call.function.arguments:
            yield (
                f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}",
                json.dumps(arguments),
            )


def _generate_trace_id() -> str:
    return _hex(DefaultOTelIDGenerator().generate_trace_id())


def _generate_span_id() -> str:
    return _hex(DefaultOTelIDGenerator().generate_span_id())


def _hex(number: int) -> str:
    return hex(number)[2:]


def _serialize_event(event: SpanException) -> dict[str, Any]:
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

PLAYGROUND_PROJECT_NAME = "playground"
