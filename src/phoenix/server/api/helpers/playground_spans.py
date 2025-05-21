import json
import logging
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import asdict
from datetime import datetime, timezone
from itertools import chain
from traceback import format_exc
from types import TracebackType
from typing import (
    Any,
    Iterable,
    Iterator,
    Optional,
    Union,
    cast,
)

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
from strawberry.scalars import JSON as JSONScalarType
from typing_extensions import Self, TypeAlias, assert_never

from phoenix.datetime_utils import local_now, normalize_datetime
from phoenix.db import models
from phoenix.server.api.helpers.dataset_helpers import get_dataset_example_output
from phoenix.server.api.input_types.ChatCompletionInput import (
    ChatCompletionInput,
    ChatCompletionOverDatasetInput,
)
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    TextChunk,
    ToolCallChunk,
)
from phoenix.server.api.types.Identifier import Identifier
from phoenix.trace.attributes import get_attribute_value, unflatten
from phoenix.trace.schemas import (
    SpanEvent,
    SpanException,
)
from phoenix.utilities.json import jsonify

ChatCompletionMessage: TypeAlias = tuple[
    ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]
]
ToolCallID: TypeAlias = str

logger = logging.getLogger(__name__)


class streaming_llm_span:
    """
    A context manager that records OpenInference attributes for streaming chat
    completion LLM spans.
    """

    def __init__(
        self,
        *,
        input: Union[ChatCompletionInput, ChatCompletionOverDatasetInput],
        messages: list[ChatCompletionMessage],
        invocation_parameters: Mapping[str, Any],
        attributes: Optional[dict[str, Any]] = None,
    ) -> None:
        self._input = input
        self._attributes: dict[str, Any] = attributes if attributes is not None else {}
        self._attributes.update(dict(prompt_metadata(input.prompt_name)))

        self._attributes.update(
            chain(
                llm_span_kind(),
                llm_model_name(input.model.name),
                llm_tools(input.tools or []),
                llm_input_messages(messages),
                llm_invocation_parameters(invocation_parameters),
                input_value_and_mime_type(input),
            )
        )
        self._events: list[SpanEvent] = []
        self._start_time: Optional[datetime] = None
        self._end_time: Optional[datetime] = None
        self._text_chunks: list[TextChunk] = []
        self._tool_call_chunks: defaultdict[ToolCallID, list[ToolCallChunk]] = defaultdict(list)
        self._status_code: StatusCode = StatusCode.UNSET
        self._status_message: Optional[str] = None
        self._trace_id = _generate_trace_id()
        self._span_id = _generate_span_id()

    async def __aenter__(self) -> Self:
        self._start_time = cast(datetime, normalize_datetime(dt=local_now(), tz=timezone.utc))
        return self

    async def __aexit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc_value: Optional[BaseException],
        traceback: Optional[TracebackType],
    ) -> bool:
        self._end_time = cast(datetime, normalize_datetime(dt=local_now(), tz=timezone.utc))
        self._status_code = StatusCode.OK
        if exc_type is not None:
            self._status_code = StatusCode.ERROR
            self._status_message = str(exc_value)
            self._events.append(
                SpanException(
                    timestamp=self._end_time,
                    message=self._status_message,
                    exception_type=type(exc_value).__name__,
                    exception_escaped=False,
                    exception_stacktrace=format_exc(),
                )
            )
            logger.exception(exc_value)
        if self._text_chunks or self._tool_call_chunks:
            self._attributes.update(
                chain(
                    _output_value_and_mime_type(self._text_chunks, self._tool_call_chunks),
                    _llm_output_messages(self._text_chunks, self._tool_call_chunks),
                )
            )
        return True

    def set_attributes(self, attributes: Mapping[str, Any]) -> None:
        self._attributes.update(attributes)

    def add_response_chunk(self, chunk: Union[TextChunk, ToolCallChunk]) -> None:
        if isinstance(chunk, TextChunk):
            self._text_chunks.append(chunk)
        elif isinstance(chunk, ToolCallChunk):
            self._tool_call_chunks[chunk.id].append(chunk)
        else:
            assert_never(chunk)

    @property
    def span_id(self) -> str:
        return self._span_id

    @property
    def trace_id(self) -> str:
        return self._trace_id

    @property
    def start_time(self) -> datetime:
        if self._start_time is None:
            raise ValueError("Cannot access start time before the context manager is entered")
        return self._start_time

    @property
    def end_time(self) -> datetime:
        if self._end_time is None:
            raise ValueError("Cannot access end time before the context manager is exited")
        return self._end_time

    @property
    def status_code(self) -> StatusCode:
        return self._status_code

    @property
    def status_message(self) -> Optional[str]:
        if self._status_code is StatusCode.UNSET:
            raise ValueError("Cannot access status message before the context manager is exited")
        return self._status_message

    @property
    def events(self) -> list[SpanEvent]:
        return self._events

    @property
    def attributes(self) -> dict[str, Any]:
        return unflatten(self._attributes.items())


def get_db_trace(span: streaming_llm_span, project_id: int) -> models.Trace:
    return models.Trace(
        project_rowid=project_id,
        trace_id=span.trace_id,
        start_time=span.start_time,
        end_time=span.end_time,
    )


def get_db_span(
    span: streaming_llm_span,
    db_trace: models.Trace,
) -> models.Span:
    prompt_tokens = get_attribute_value(span.attributes, LLM_TOKEN_COUNT_PROMPT) or 0
    completion_tokens = get_attribute_value(span.attributes, LLM_TOKEN_COUNT_COMPLETION) or 0
    return models.Span(
        trace_rowid=db_trace.id,
        span_id=span.span_id,
        parent_id=None,
        name="ChatCompletion",
        span_kind=LLM,
        start_time=span.start_time,
        end_time=span.end_time,
        attributes=span.attributes,
        events=[_serialize_event(event) for event in span.events],
        status_code=span.status_code.name,
        status_message=span.status_message or "",
        cumulative_error_count=int(span.status_code is StatusCode.ERROR),
        cumulative_llm_token_count_prompt=prompt_tokens,
        cumulative_llm_token_count_completion=completion_tokens,
        llm_token_count_prompt=prompt_tokens,
        llm_token_count_completion=completion_tokens,
        trace=db_trace,
    )


def get_db_experiment_run(
    db_span: models.Span,
    db_trace: models.Trace,
    *,
    experiment_id: int,
    example_id: int,
) -> models.ExperimentRun:
    return models.ExperimentRun(
        experiment_id=experiment_id,
        dataset_example_id=example_id,
        trace_id=db_trace.trace_id,
        output=models.ExperimentRunOutput(
            task_output=get_dataset_example_output(db_span),
        ),
        repetition_number=1,
        start_time=db_span.start_time,
        end_time=db_span.end_time,
        error=db_span.status_message or None,
        prompt_token_count=get_attribute_value(db_span.attributes, LLM_TOKEN_COUNT_PROMPT),
        completion_token_count=get_attribute_value(db_span.attributes, LLM_TOKEN_COUNT_COMPLETION),
        trace=db_trace,
    )


def llm_span_kind() -> Iterator[tuple[str, Any]]:
    yield OPENINFERENCE_SPAN_KIND, LLM


def llm_model_name(model_name: str) -> Iterator[tuple[str, Any]]:
    yield LLM_MODEL_NAME, model_name


def llm_invocation_parameters(
    invocation_parameters: Mapping[str, Any],
) -> Iterator[tuple[str, Any]]:
    if invocation_parameters:
        yield LLM_INVOCATION_PARAMETERS, safe_json_dumps(invocation_parameters)


def llm_tools(tools: list[JSONScalarType]) -> Iterator[tuple[str, Any]]:
    for tool_index, tool in enumerate(tools):
        yield f"{LLM_TOOLS}.{tool_index}.{TOOL_JSON_SCHEMA}", json.dumps(tool)


def input_value_and_mime_type(
    input: Union[ChatCompletionInput, ChatCompletionOverDatasetInput],
) -> Iterator[tuple[str, Any]]:
    assert (api_key := "api_key") in (input_data := jsonify(input))
    disallowed_keys = {"api_key", "invocation_parameters"}
    input_data = {k: v for k, v in input_data.items() if k not in disallowed_keys}
    assert api_key not in input_data
    yield INPUT_MIME_TYPE, JSON
    yield INPUT_VALUE, safe_json_dumps(input_data)


def prompt_metadata(prompt_name: Optional[Identifier]) -> Iterator[tuple[str, Any]]:
    if prompt_name:
        yield METADATA, {"phoenix_prompt_id": prompt_name}


def _merge_tool_call_chunks(
    chunks_by_id: defaultdict[str, list[ToolCallChunk]],
) -> list[dict[str, Any]]:
    merged_tool_calls = []

    for tool_id, chunks in chunks_by_id.items():
        if not chunks:
            continue
        first_chunk = chunks[0]
        if not first_chunk:
            continue

        if not hasattr(first_chunk, "function") or not hasattr(first_chunk.function, "name"):
            continue
        # Combine all argument chunks
        merged_arguments = "".join(
            chunk.function.arguments
            for chunk in chunks
            if chunk and hasattr(chunk, "function") and hasattr(chunk.function, "arguments")
        )

        merged_tool_calls.append(
            {
                "id": tool_id,
                # Only the first chunk has the tool name
                "function": {
                    "name": first_chunk.function.name,
                    "arguments": merged_arguments or "{}",
                },
            }
        )

    return merged_tool_calls


def _output_value_and_mime_type(
    text_chunks: list[TextChunk],
    tool_call_chunks: defaultdict[ToolCallID, list[ToolCallChunk]],
) -> Iterator[tuple[str, Any]]:
    content = "".join(chunk.content for chunk in text_chunks)
    merged_tool_calls = _merge_tool_call_chunks(tool_call_chunks)
    if content and merged_tool_calls:
        yield OUTPUT_MIME_TYPE, JSON
        yield (
            OUTPUT_VALUE,
            safe_json_dumps(
                {
                    "content": content,
                    "tool_calls": jsonify(
                        merged_tool_calls,
                    ),
                }
            ),
        )
    elif merged_tool_calls:
        yield OUTPUT_MIME_TYPE, JSON
        yield OUTPUT_VALUE, safe_json_dumps(jsonify(merged_tool_calls))
    elif content:
        yield OUTPUT_MIME_TYPE, TEXT
        yield OUTPUT_VALUE, content


def llm_input_messages(
    messages: Iterable[
        tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
    ],
) -> Iterator[tuple[str, Any]]:
    for i, (role, content, tool_call_id, tool_calls) in enumerate(messages):
        yield f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_ROLE}", role.value.lower()
        yield f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_CONTENT}", content
        if role == ChatCompletionMessageRole.TOOL and tool_call_id:
            # Anthropic tool result spans
            yield f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_TOOL_CALL_ID}", tool_call_id

        if tool_calls is not None:
            for tool_call_index, tool_call in enumerate(tool_calls):
                if tool_call.get("type") == "tool_use":
                    # Anthropic tool call spans
                    yield (
                        f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_NAME}",
                        tool_call["name"],
                    )
                    yield (
                        f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}",
                        safe_json_dumps(jsonify(tool_call["input"])),
                    )
                    yield (
                        f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_ID}",
                        tool_call["id"],
                    )
                elif tool_call_function := tool_call.get("function"):
                    # OpenAI tool call spans
                    yield (
                        f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_NAME}",
                        tool_call_function["name"],
                    )
                    if arguments := tool_call_function["arguments"]:
                        yield (
                            f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}",
                            safe_json_dumps(jsonify(arguments)),
                        )
                    if tool_call_id := tool_call.get("id"):
                        yield (
                            f"{LLM_INPUT_MESSAGES}.{i}.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_ID}",
                            tool_call_id,
                        )


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


def _serialize_event(event: SpanEvent) -> dict[str, Any]:
    """
    Serializes a SpanEvent to a dictionary.
    """
    return {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in asdict(event).items()}


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
