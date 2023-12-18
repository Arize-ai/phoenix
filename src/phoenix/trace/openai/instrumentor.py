import json
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from inspect import BoundArguments, signature
from types import TracebackType
from typing import (
    Any,
    AsyncIterator,
    Callable,
    ContextManager,
    Coroutine,
    DefaultDict,
    Dict,
    Iterator,
    List,
    Mapping,
    Optional,
    Tuple,
    Type,
    TypeVar,
    cast,
)

import openai
from openai import AsyncStream, Stream
from openai.types.chat import ChatCompletion, ChatCompletionChunk
from typing_extensions import ParamSpec
from wrapt import ObjectProxy

from phoenix.trace.schemas import (
    MimeType,
    SpanAttributes,
    SpanEvent,
    SpanException,
    SpanKind,
    SpanStatusCode,
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
)
from phoenix.trace.utils import get_stacktrace

from ..tracer import Tracer

ParameterSpec = ParamSpec("ParameterSpec")
GenericType = TypeVar("GenericType")
AsyncCallable = Callable[ParameterSpec, Coroutine[Any, Any, GenericType]]
Parameters = Mapping[str, Any]
OpenInferenceMessage = Dict[str, str]

INSTRUMENTED_ATTRIBUTE_NAME = "is_instrumented_with_openinference_tracer"


class RequestType(Enum):
    CHAT_COMPLETION = "chat_completion"
    COMPLETION = "completion"
    EMBEDDING = "embedding"


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
        self.tracer = tracer
        self.start_time: Optional[datetime] = None
        self.status_code = SpanStatusCode.UNSET
        self.status_message = ""
        self.events: List[SpanEvent] = []
        self.attributes: SpanAttributes = dict()
        parameters = _parameters(bound_arguments)
        self.num_choices = parameters.get("n", 1)
        self.chat_completion_chunks: List[ChatCompletionChunk] = []
        self.stream_complete = False
        self._process_parameters(parameters)
        self._span_created = False

    def __enter__(self) -> "ChatCompletionContext":
        self.start_time = datetime.now(tz=timezone.utc)
        return self

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_value: Optional[BaseException],
        traceback: Optional[TracebackType],
    ) -> None:
        if exc_value is None:
            return
        self.status_code = SpanStatusCode.ERROR
        status_message = str(exc_value)
        self.status_message = status_message
        self.events.append(
            SpanException(
                message=status_message,
                timestamp=datetime.now(tz=timezone.utc),
                exception_type=type(exc_value).__name__,
                exception_stacktrace=get_stacktrace(exc_value),
            )
        )
        self.create_span()

    def process_response(self, response: Any) -> Any:
        """
        Processes the response from the OpenAI chat completions API call to extract attributes.

        Args:
            response (ChatCompletion): The chat completion object.
        """
        if isinstance(response, ChatCompletion):
            self._process_chat_completion(response)
        elif isinstance(response, Stream):
            return StreamWrapper(stream=response, context=self)
        elif isinstance(response, AsyncStream):
            return AsyncStreamWrapper(stream=response, context=self)
        elif hasattr(response, "parse") and callable(
            response.parse
        ):  # handle raw response by converting them to chat completions
            self._process_chat_completion(response.parse())
        self.status_code = SpanStatusCode.OK
        self.create_span()
        return response

    def create_span(self) -> None:
        """
        Creates a span from the context if one has not already been created.
        """
        if self._span_created:
            return
        self.tracer.create_span(
            name="OpenAI Chat Completion",
            span_kind=SpanKind.LLM,
            start_time=cast(datetime, self.start_time),
            end_time=datetime.now(tz=timezone.utc),
            status_code=self.status_code,
            status_message=self.status_message,
            attributes=self.attributes,
            events=self.events,
        )
        self._span_created = True

    def _process_chat_completion(self, chat_completion: ChatCompletion) -> None:
        """
        Processes a chat completion response to extract and add fields and
        attributes to the context.

        Args:
            chat_completion (ChatCompletion): Response object from the chat
            completions API.
        """
        for (
            attribute_name,
            get_chat_completion_attribute_fn,
        ) in _CHAT_COMPLETION_ATTRIBUTE_FUNCTIONS.items():
            if (attribute_value := get_chat_completion_attribute_fn(chat_completion)) is not None:
                self.attributes[attribute_name] = attribute_value

    def _process_parameters(self, parameters: Parameters) -> None:
        """
        Processes the input parameters to the chat completions API to extract
        and add fields and attributes to the context.

        Args:
            parameters (Parameters): Input parameters.
        """
        for (
            attribute_name,
            get_parameter_attribute_fn,
        ) in _PARAMETER_ATTRIBUTE_FUNCTIONS.items():
            if (attribute_value := get_parameter_attribute_fn(parameters)) is not None:
                self.attributes[attribute_name] = attribute_value


class StreamWrapper(ObjectProxy):  # type: ignore
    """
    A wrapper for streams of chat completion chunks that records events and
    creates the span upon completion of the stream or upon an exception.
    """

    def __init__(self, stream: Stream[ChatCompletionChunk], context: ChatCompletionContext) -> None:
        """Initializes the stream wrapper.

        Args:
            stream (Stream[ChatCompletionChunk]): The stream to wrap.

            context (ChatCompletionContext): The context used to store span
            fields and attributes.
        """
        super().__init__(stream)
        self._self_context = ChatCompletionStreamEventContext(context)

    def __next__(self) -> ChatCompletionChunk:
        """
        A wrapped __next__ method that records span stream events and updates
        the span upon completion of the stream or upon exception.

        Returns:
            ChatCompletionChunk: The forwarded chat completion chunk.
        """
        with self._self_context as context:
            chat_completion_chunk = next(self.__wrapped__)
            context.process_chat_completion_chunk(chat_completion_chunk)
            return cast(ChatCompletionChunk, chat_completion_chunk)

    def __iter__(self) -> Iterator[ChatCompletionChunk]:
        """
        A __iter__ method that bypasses the wrapped class' __iter__ method so
        that __iter__ is automatically instrumented using __next__.
        """
        return self


class AsyncStreamWrapper(ObjectProxy):  # type: ignore
    """
    A wrapper for asynchronous streams of chat completion chunks that records
    events and creates the span upon completion of the stream or upon an
    exception.
    """

    def __init__(
        self, stream: AsyncStream[ChatCompletionChunk], context: ChatCompletionContext
    ) -> None:
        """Initializes the stream wrapper.

        Args:
            stream (AsyncStream[ChatCompletionChunk]): The stream to wrap.

            context (ChatCompletionContext): The context used to store span
            fields and attributes.
        """
        super().__init__(stream)
        self._self_context = ChatCompletionStreamEventContext(context)

    async def __anext__(self) -> ChatCompletionChunk:
        """
        A wrapped __anext__ method that records span stream events and updates
        the span upon completion of the stream or upon exception.

        Returns:
            ChatCompletionChunk: The forwarded chat completion chunk.
        """
        with self._self_context as context:
            chat_completion_chunk = await self.__wrapped__.__anext__()
            context.process_chat_completion_chunk(chat_completion_chunk)
            return cast(ChatCompletionChunk, chat_completion_chunk)

    def __aiter__(self) -> AsyncIterator[ChatCompletionChunk]:
        """
        An __aiter__ method that bypasses the wrapped class' __aiter__ method so
        that __aiter__ is automatically instrumented using __anext__.
        """
        return self


class ChatCompletionStreamEventContext(ContextManager["ChatCompletionStreamEventContext"]):
    """
    A context manager that surrounds stream events in a stream of chat
    completions and processes each chat completion chunk.
    """

    def __init__(self, chat_completion_context: ChatCompletionContext) -> None:
        """Initializes the context manager.

        Args:
            chat_completion_context (ChatCompletionContext): The chat completion
            context storing span fields and attributes.
        """
        self._context = chat_completion_context

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_value: Optional[BaseException],
        traceback: Optional[TracebackType],
    ) -> None:
        if isinstance(exc_value, StopIteration) or isinstance(exc_value, StopAsyncIteration):
            self._context.stream_complete = True
            self._context.status_code = SpanStatusCode.OK
        elif exc_value is not None:
            self._context.stream_complete = True
            self._context.status_code = SpanStatusCode.ERROR
            status_message = str(exc_value)
            self._context.status_message = status_message
            self._context.events.append(
                SpanException(
                    message=status_message,
                    timestamp=datetime.now(tz=timezone.utc),
                    exception_type=type(exc_value).__name__,
                    exception_stacktrace=get_stacktrace(exc_value),
                )
            )
        if not self._context.stream_complete:
            return
        self._context.attributes = {
            **self._context.attributes,
            LLM_OUTPUT_MESSAGES: _accumulate_messages(
                chunks=self._context.chat_completion_chunks,
                num_choices=self._context.num_choices,
            ),  # type: ignore
            OUTPUT_VALUE: json.dumps(
                [chunk.dict() for chunk in self._context.chat_completion_chunks]
            ),
            OUTPUT_MIME_TYPE: MimeType.JSON,  # type: ignore
        }
        self._context.create_span()

    def process_chat_completion_chunk(self, chat_completion_chunk: ChatCompletionChunk) -> None:
        """
        Processes a chat completion chunk and adds relevant information to the
        context.

        Args:
            chat_completion_chunk (ChatCompletionChunk): The chat completion
            chunk to be processed.
        """
        if not self._context.chat_completion_chunks:
            self._context.events.append(
                SpanEvent(
                    name="First Token Stream Event",
                    timestamp=datetime.now(tz=timezone.utc),
                    attributes={},
                )
            )
        self._context.chat_completion_chunks.append(chat_completion_chunk)


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
            return context.process_response(response)

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
            return context.process_response(response)

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


def _parameters(bound_arguments: BoundArguments) -> Parameters:
    """
    The parameters for the LLM call, e.g., temperature.

    Args:
        bound_arguments (BoundArguments): The bound arguments to the request function.

    Returns:
        Parameters: The parameters to the request function.
    """
    return cast(Parameters, bound_arguments.arguments["options"].json_data)


@dataclass
class StreamingFunctionCallData:
    """
    Stores function call data from a streaming chat completion.
    """

    name: Optional[str] = None
    argument_tokens: List[str] = field(default_factory=list)


def _accumulate_messages(
    chunks: List[ChatCompletionChunk], num_choices: int
) -> List[OpenInferenceMessage]:
    """
    Converts a list of chat completion chunks to a list of OpenInference messages.

    Args:
        chunks (List[ChatCompletionChunk]): The input chunks to be converted.

        num_choices (int): The number of choices in the chat completion (i.e.,
        the parameter `n` in the input parameters).

    Returns:
        List[OpenInferenceMessage]: The list of OpenInference messages.
    """
    if not chunks:
        return []
    content_token_lists: DefaultDict[int, List[str]] = defaultdict(list)
    function_calls: DefaultDict[int, StreamingFunctionCallData] = defaultdict(
        StreamingFunctionCallData
    )
    tool_calls: DefaultDict[int, DefaultDict[int, StreamingFunctionCallData]] = defaultdict(
        lambda: defaultdict(StreamingFunctionCallData)
    )
    roles: Dict[int, str] = {}
    for chunk in chunks:
        for choice in chunk.choices:
            choice_index = choice.index
            if content_token := choice.delta.content:
                content_token_lists[choice_index].append(content_token)
            if function_call := choice.delta.function_call:
                if function_name := function_call.name:
                    function_calls[choice_index].name = function_name
                if (function_argument_token := function_call.arguments) is not None:
                    function_calls[choice_index].argument_tokens.append(function_argument_token)
            if role := choice.delta.role:
                roles[choice_index] = role
            if choice.delta.tool_calls:
                for tool_call in choice.delta.tool_calls:
                    tool_index = tool_call.index
                    if not tool_call.function:
                        continue
                    if (name := tool_call.function.name) is not None:
                        tool_calls[choice_index][tool_index].name = name
                    if (arguments := tool_call.function.arguments) is not None:
                        tool_calls[choice_index][tool_index].argument_tokens.append(arguments)

    messages: List[OpenInferenceMessage] = []
    for choice_index in range(num_choices):
        message: Dict[str, Any] = {}
        if (role_ := roles.get(choice_index)) is not None:
            message[MESSAGE_ROLE] = role_
        if content_tokens := content_token_lists[choice_index]:
            message[MESSAGE_CONTENT] = "".join(content_tokens)
        if function_call_ := function_calls.get(choice_index):
            if (name := function_call_.name) is not None:
                message[MESSAGE_FUNCTION_CALL_NAME] = name
            if argument_tokens := function_call_.argument_tokens:
                message[MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON] = "".join(argument_tokens)
        if tool_calls_ := tool_calls.get(choice_index):
            num_tool_calls = max(tool_index for tool_index in tool_calls_.keys()) + 1
            message[MESSAGE_TOOL_CALLS] = [{} for _ in range(num_tool_calls)]
            for tool_index, tool_call_ in tool_calls_.items():
                if (name := tool_call_.name) is not None:
                    message[MESSAGE_TOOL_CALLS][tool_index][TOOL_CALL_FUNCTION_NAME] = name
                if argument_tokens := tool_call_.argument_tokens:
                    message[MESSAGE_TOOL_CALLS][tool_index][
                        TOOL_CALL_FUNCTION_ARGUMENTS_JSON
                    ] = "".join(argument_tokens)
        messages.append(message)

    return messages
