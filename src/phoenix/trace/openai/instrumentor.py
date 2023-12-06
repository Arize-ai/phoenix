import json
from copy import deepcopy
from dataclasses import replace
from datetime import datetime
from enum import Enum
from inspect import BoundArguments, signature
from types import TracebackType
from typing import (
    Any,
    Callable,
    ContextManager,
    Coroutine,
    Dict,
    Iterator,
    List,
    Mapping,
    Optional,
    Tuple,
    Type,
    TypeVar,
    Union,
    cast,
)

import openai
from openai import Stream
from openai.types.chat import ChatCompletion, ChatCompletionChunk
from typing_extensions import ParamSpec
from wrapt import ObjectProxy

from phoenix.trace.schemas import (
    Span,
    SpanAttributes,
    SpanEvent,
    SpanException,
    SpanKind,
    SpanStatusCode,
    SpanStreamEvent,
)
from phoenix.trace.semantic_conventions import (
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    LLM_FUNCTION_CALL,
    LLM_INPUT_MESSAGES,
    LLM_INVOCATION_PARAMETERS,
    LLM_OUTPUT_MESSAGES,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    MESSAGE_CONTENT,
    MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON,
    MESSAGE_FUNCTION_CALL_NAME,
    MESSAGE_NAME,
    MESSAGE_ROLE,
    MESSAGE_TOOL_CALLS,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    TOOL_CALL_FUNCTION_ARGUMENTS_JSON,
    TOOL_CALL_FUNCTION_NAME,
    MimeType,
)
from phoenix.trace.utils import get_stacktrace

from ..tracer import Tracer

ParameterSpec = ParamSpec("ParameterSpec")
GenericType = TypeVar("GenericType")
ChatCompletionResponseType = TypeVar(
    "ChatCompletionResponseType", ChatCompletion, Stream[ChatCompletionChunk]
)
AsyncCallable = Callable[ParameterSpec, Coroutine[Any, Any, GenericType]]
Parameters = Mapping[str, Any]
OpenInferenceMessage = Dict[str, str]

INSTRUMENTED_ATTRIBUTE_NAME = "is_instrumented_with_openinference_tracer"


class RequestType(Enum):
    CHAT_COMPLETION = "chat_completion"
    COMPLETION = "completion"
    EMBEDDING = "embedding"


def _span_stream_event(chat_completion_chunk: ChatCompletionChunk) -> SpanStreamEvent:
    stream_event = SpanStreamEvent(
        name="Chat Completion Stream Event", timestamp=datetime.now(), attributes={}
    )
    return stream_event


def _accumulate_event_attributes(events: List[SpanEvent]) -> SpanAttributes:
    return {}


class StreamWrapper(ObjectProxy):  # type: ignore
    def __init__(
        self, stream: Stream[ChatCompletionChunk], context: "ChatCompletionContext"
    ) -> None:
        super().__init__(stream)
        self._context = context
        self._events: List[SpanEvent] = []

    def __next__(self) -> ChatCompletionChunk:
        try:
            chat_completion_chunk = next(self.__wrapped__)
            self._events.append(_span_stream_event(chat_completion_chunk))
        except StopIteration:
            span = self._context.span
            span = replace(
                span,
                attributes={
                    **deepcopy(span.attributes),
                    **_accumulate_event_attributes(self._events),
                },
                events=deepcopy(span.events) + self._events,
            )
            self._context.tracer.add_span(span)
            raise
        return cast(ChatCompletionChunk, chat_completion_chunk)


class StreamProcessor:
    def __init__(self, context: "ChatCompletionContext") -> None:
        self._context = context

    def process(self, response: Stream[ChatCompletionChunk]) -> Stream[ChatCompletionChunk]:
        return StreamWrapper(stream=response, context=self._context)


class ChatCompletionProcessor:
    def __init__(self, context: "ChatCompletionContext") -> None:
        self._context = context

    def process(self, response: ChatCompletion) -> ChatCompletion:
        """
        Processes a chat completions response to extract attributes and adds
        them to the context.

        Args:
            response (ChatCompletion): Response from the OpenAI chat completions
            API.

        Returns:
            ChatCompletion: The input chat completion object.
        """
        for (
            attribute_name,
            get_chat_completion_attribute_fn,
        ) in _CHAT_COMPLETION_ATTRIBUTE_FUNCTIONS.items():
            if (attribute_value := get_chat_completion_attribute_fn(response)) is not None:
                self._context._attributes[attribute_name] = attribute_value
        return response


class OpenAIInstrumentor:
    def __init__(self, tracer: Optional[Tracer] = None) -> None:
        """Instruments your OpenAI client to automatically create spans for each API call.

        Args:
            tracer (Optional[Tracer], optional): A tracer to record and handle spans. If not
            provided, the default tracer will be used.
        """
        self._tracer = tracer or Tracer()

    def instrument(self) -> None:
        """
        Instruments your OpenAI client.
        """
        if not hasattr(openai.OpenAI, INSTRUMENTED_ATTRIBUTE_NAME):
            openai.OpenAI.request = _wrapped_openai_sync_client_request_function(  # type: ignore
                openai.OpenAI.request, self._tracer
            )
            setattr(
                openai.OpenAI,
                INSTRUMENTED_ATTRIBUTE_NAME,
                True,
            )
        if not hasattr(openai.AsyncOpenAI, INSTRUMENTED_ATTRIBUTE_NAME):
            openai.AsyncOpenAI.request = _wrapped_openai_async_client_request_function(  # type: ignore
                openai.AsyncOpenAI.request, self._tracer
            )
            setattr(
                openai.AsyncOpenAI,
                INSTRUMENTED_ATTRIBUTE_NAME,
                True,
            )


class ChatCompletionContext(ContextManager["ChatCompletionContext"]):
    """
    A context manager for creating spans for chat completion requests. The
    context manager extracts attributes from the input parameters and response
    from the API and records any exceptions that are raised.
    """

    def __init__(self, bound_arguments: BoundArguments, tracer: Tracer) -> None:
        """
        Initializes the context manager.

        Args:
            bound_arguments (BoundArguments): The arguments to the request
            function from which parameter attributes are extracted.

            tracer (Tracer): The tracer to use to create spans.
        """
        self._tracer = tracer
        self._span: Optional[Span] = None
        self._response_processor: Union[StreamProcessor, ChatCompletionProcessor] = (
            StreamProcessor(self)
            if _is_streaming_request(bound_arguments)
            else ChatCompletionProcessor(self)
        )
        self._start_time: Optional[datetime] = None
        self._end_time: Optional[datetime] = None
        self._status_code = SpanStatusCode.UNSET
        self._status_message = ""
        self._events: List[SpanEvent] = []
        self._attributes: SpanAttributes = dict()
        parameters = _parameters(bound_arguments)
        self._process_parameters(parameters)

    def __enter__(self) -> "ChatCompletionContext":
        self._start_time = datetime.now()
        return self

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_value: Optional[BaseException],
        traceback: Optional[TracebackType],
    ) -> None:
        if exc_value is None:
            return
        self._end_time = datetime.now()
        self._status_code = SpanStatusCode.ERROR
        status_message = str(exc_value)
        self._status_message = status_message
        self._events.append(
            SpanException(
                message=status_message,
                timestamp=self._end_time,
                exception_type=type(exc_value).__name__,
                exception_stacktrace=get_stacktrace(exc_value),
            )
        )
        self._create_span()

    def process_response(self, response: ChatCompletionResponseType) -> ChatCompletionResponseType:
        """
        Processes the response from the OpenAI chat completions API call to extract attributes.

        Args:
            response (ChatCompletion): The chat completion object.
        """
        self._end_time = datetime.now()
        self._status_code = SpanStatusCode.OK
        response = self._response_processor.process(response)  # type: ignore
        self._create_span()
        return response

    def _process_parameters(self, parameters: Parameters) -> None:
        for (
            attribute_name,
            get_parameter_attribute_fn,
        ) in _PARAMETER_ATTRIBUTE_FUNCTIONS.items():
            if (attribute_value := get_parameter_attribute_fn(parameters)) is not None:
                self._attributes[attribute_name] = attribute_value

    def _create_span(self) -> None:
        self._span = self._tracer.create_span(
            name="OpenAI Chat Completion",
            span_kind=SpanKind.LLM,
            start_time=cast(datetime, self._start_time),
            end_time=self._end_time,
            status_code=self._status_code,
            status_message=self._status_message,
            attributes=self._attributes,
            events=self._events,
        )

    @property
    def tracer(self) -> Tracer:
        return self._tracer

    @property
    def span(self) -> Span:
        if self._span is None:
            raise ValueError("Span has not been created yet.")
        return self._span


def _wrapped_openai_sync_client_request_function(
    request_fn: Callable[ParameterSpec, GenericType], tracer: Tracer
) -> Callable[ParameterSpec, GenericType]:
    """
    Wraps the synchronous OpenAI client's request method to create spans for
    each API call.

    Args:
        request_fn (Callable[ParameterSpec, GenericType]): The request method on
        the OpenAI client.

        tracer (Tracer): The tracer to use to create spans.

    Returns:
        Callable[ParameterSpec, GenericType]: The wrapped request method.
    """
    call_signature = signature(request_fn)

    def wrapped(*args: Any, **kwargs: Any) -> Any:
        bound_arguments = call_signature.bind(*args, **kwargs)
        if _request_type(bound_arguments) is not RequestType.CHAT_COMPLETION:
            return request_fn(*args, **kwargs)
        with ChatCompletionContext(bound_arguments, tracer) as context:
            response = request_fn(*args, **kwargs)
            context.process_response(
                response.parse()
                if hasattr(response, "parse") and callable(response.parse)
                else response,
            )
            return response

    return wrapped


def _wrapped_openai_async_client_request_function(
    request_fn: AsyncCallable[ParameterSpec, GenericType], tracer: Tracer
) -> AsyncCallable[ParameterSpec, GenericType]:
    """
    Wraps the asynchronous AsyncOpenAI client's request method to create spans
    for each API call.

    Args:
        request_fn (AsyncCallable[ParameterSpec, GenericType]): The request
        method on the AsyncOpenAI client.

        tracer (Tracer): The tracer to use to create spans.

    Returns:
        AsyncCallable[ParameterSpec, GenericType]: The wrapped request method.
    """
    call_signature = signature(request_fn)

    async def wrapped(*args: Any, **kwargs: Any) -> Any:
        bound_arguments = call_signature.bind(*args, **kwargs)
        if _request_type(bound_arguments) is not RequestType.CHAT_COMPLETION:
            return await request_fn(*args, **kwargs)
        with ChatCompletionContext(bound_arguments, tracer) as context:
            response = await request_fn(*args, **kwargs)
            context.process_response(
                response.parse()
                if hasattr(response, "parse") and callable(response.parse)
                else response,
            )
            return response

    return wrapped


def _input_value(parameters: Parameters) -> str:
    return json.dumps(parameters)


def _input_mime_type(_: Any) -> MimeType:
    return MimeType.JSON


def _llm_input_messages(parameters: Parameters) -> Optional[List[OpenInferenceMessage]]:
    if not (messages := parameters.get("messages")):
        return None
    return [_to_openinference_message(message, expects_name=True) for message in messages]


def _llm_invocation_parameters(
    parameters: Parameters,
) -> str:
    return json.dumps(parameters)


def _output_value(chat_completion: ChatCompletion) -> str:
    return chat_completion.json()


def _output_mime_type(_: Any) -> MimeType:
    return MimeType.JSON


def _llm_output_messages(chat_completion: ChatCompletion) -> List[OpenInferenceMessage]:
    return [
        _to_openinference_message(choice.message.dict(), expects_name=False)
        for choice in chat_completion.choices
    ]


def _llm_token_count_prompt(chat_completion: ChatCompletion) -> Optional[int]:
    if completion_usage := chat_completion.usage:
        return completion_usage.prompt_tokens
    return None


def _llm_token_count_completion(chat_completion: ChatCompletion) -> Optional[int]:
    if completion_usage := chat_completion.usage:
        return completion_usage.completion_tokens
    return None


def _llm_token_count_total(chat_completion: ChatCompletion) -> Optional[int]:
    if completion_usage := chat_completion.usage:
        return completion_usage.total_tokens
    return None


def _llm_function_call(
    chat_completion: ChatCompletion,
) -> Optional[str]:
    choices = chat_completion.choices
    choice = choices[0]
    if choice.finish_reason == "function_call" and (function_call := choice.message.function_call):
        return function_call.json()
    return None


def _request_type(bound_arguments: BoundArguments) -> Optional[RequestType]:
    options = bound_arguments.arguments["options"]
    url = options.url
    """Get OpenAI request type from URL, or returns None if the request type cannot be recognized"""
    if "chat/completions" in url:
        return RequestType.CHAT_COMPLETION
    if "completions" in url:
        return RequestType.COMPLETION
    if "embeddings" in url:
        return RequestType.EMBEDDING
    return None


def _to_openinference_message(
    message: Mapping[str, Any], *, expects_name: bool
) -> OpenInferenceMessage:
    """Converts an OpenAI input or output message to an OpenInference message.

    Args:
        message (Dict[str, Any]): The OpenAI message to be parsed.

        expects_name (bool): Whether to parse the "name" key in the OpenAI message. This key is
        sometimes included in "function"-role input messages to specify the function name, but is
        not included in output messages.

    Returns:
        OpenInferenceMessage: A message in OpenInference format.
    """
    openinference_message = {}
    if role := message.get("role"):
        openinference_message[MESSAGE_ROLE] = role
    if content := message.get("content"):
        openinference_message[MESSAGE_CONTENT] = content
    if function_call_data := message.get("function_call"):
        if function_name := function_call_data.get("name"):
            openinference_message[MESSAGE_FUNCTION_CALL_NAME] = function_name
        if function_arguments := function_call_data.get("arguments"):
            openinference_message[MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON] = function_arguments
    if tool_calls_data := message.get("tool_calls"):
        message_tool_calls = []
        for tool_call_data in tool_calls_data:
            if message_tool_call := dict(_get_tool_call(tool_call_data)):
                message_tool_calls.append(message_tool_call)
        if message_tool_calls:
            openinference_message[MESSAGE_TOOL_CALLS] = message_tool_calls
    if expects_name and (name := message.get("name")):
        openinference_message[MESSAGE_NAME] = name
    return openinference_message


def _get_tool_call(tool_call: Mapping[str, Any]) -> Iterator[Tuple[str, Any]]:
    if function := tool_call.get("function"):
        if name := function.get("name"):
            yield TOOL_CALL_FUNCTION_NAME, name
        if arguments := function.get("arguments"):
            yield TOOL_CALL_FUNCTION_ARGUMENTS_JSON, arguments


_PARAMETER_ATTRIBUTE_FUNCTIONS: Dict[str, Callable[[Parameters], Any]] = {
    INPUT_VALUE: _input_value,
    INPUT_MIME_TYPE: _input_mime_type,
    LLM_INPUT_MESSAGES: _llm_input_messages,
    LLM_INVOCATION_PARAMETERS: _llm_invocation_parameters,
}
_CHAT_COMPLETION_ATTRIBUTE_FUNCTIONS: Dict[str, Callable[[ChatCompletion], Any]] = {
    OUTPUT_VALUE: _output_value,
    OUTPUT_MIME_TYPE: _output_mime_type,
    LLM_OUTPUT_MESSAGES: _llm_output_messages,
    LLM_TOKEN_COUNT_PROMPT: _llm_token_count_prompt,
    LLM_TOKEN_COUNT_COMPLETION: _llm_token_count_completion,
    LLM_TOKEN_COUNT_TOTAL: _llm_token_count_total,
    LLM_FUNCTION_CALL: _llm_function_call,
}


def _is_streaming_request(bound_arguments: BoundArguments) -> bool:
    """
    Determines whether the request is a streaming request.

    Args:
        bound_arguments (BoundArguments): The bound arguments to the request function.

    Returns:
        bool: True if the request is a streaming request, False otherwise.
    """
    return cast(bool, bound_arguments.arguments["stream"])


def _parameters(bound_arguments: BoundArguments) -> Parameters:
    """
    The parameters for the LLM call, e.g., temperature.

    Args:
        bound_arguments (BoundArguments): The bound arguments to the request function.

    Returns:
        Parameters: The parameters to the request function.
    """
    return cast(Parameters, bound_arguments.arguments["options"].json_data)
