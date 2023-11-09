import json
from datetime import datetime
from enum import Enum
from inspect import signature
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Dict,
    List,
    Mapping,
    Optional,
    cast,
)

from phoenix.trace.schemas import (
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
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    MimeType,
)
from phoenix.trace.utils import get_stacktrace, import_package

from ..tracer import Tracer

if TYPE_CHECKING:
    from openai.types.chat import ChatCompletion


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
        openai = import_package("openai")
        is_instrumented = hasattr(
            openai._base_client.SyncAPIClient,
            INSTRUMENTED_ATTRIBUTE_NAME,
        )
        if not is_instrumented:
            openai._base_client.SyncAPIClient.request = _wrap_openai_api_requestor(
                openai._base_client.SyncAPIClient.request, self._tracer
            )
            setattr(
                openai._base_client.SyncAPIClient,
                INSTRUMENTED_ATTRIBUTE_NAME,
                True,
            )


def _wrap_openai_api_requestor(
    request_fn: Callable[..., Any], tracer: Tracer
) -> Callable[..., Any]:
    """Wraps the OpenAI APIRequestor.request method to create spans for each API call.

    Args:
        request_fn (Callable[..., Any]): The request method on openai.api_requestor.APIRequestor.
        tracer (Tracer): The tracer to use to create spans.

    Returns:
        Callable[..., Any]: The wrapped request method.
    """

    def wrapped(*args: Any, **kwargs: Any) -> Any:
        call_signature = signature(request_fn)
        bound_arguments = call_signature.bind(*args, **kwargs)
        is_streaming = bound_arguments.arguments["stream"]
        options = bound_arguments.arguments["options"]
        json_data = options.json_data
        url = options.url
        current_status_code = SpanStatusCode.UNSET
        events: List[SpanEvent] = []
        attributes: SpanAttributes = dict()
        if not is_streaming and _get_request_type(url) is RequestType.CHAT_COMPLETION:
            for (
                attribute_name,
                get_parameter_attribute_fn,
            ) in _PARAMETER_ATTRIBUTE_FUNCTIONS.items():
                if (attribute_value := get_parameter_attribute_fn(json_data)) is not None:
                    attributes[attribute_name] = attribute_value
            chat_completion = None
            try:
                start_time = datetime.now()
                chat_completion = request_fn(*args, **kwargs)
                end_time = datetime.now()
                current_status_code = SpanStatusCode.OK
                return chat_completion
            except Exception as error:
                end_time = datetime.now()
                current_status_code = SpanStatusCode.ERROR
                events.append(
                    SpanException(
                        message=str(error),
                        timestamp=end_time,
                        exception_type=type(error).__name__,
                        exception_stacktrace=get_stacktrace(error),
                    )
                )
                raise
            finally:
                if chat_completion:
                    for (
                        attribute_name,
                        get_response_attribute_fn,
                    ) in _RESPONSE_ATTRIBUTE_FUNCTIONS.items():
                        if (
                            attribute_value := get_response_attribute_fn(chat_completion.dict())
                        ) is not None:
                            attributes[attribute_name] = attribute_value
                tracer.create_span(
                    name="OpenAI Chat Completion",
                    span_kind=SpanKind.LLM,
                    start_time=start_time,
                    end_time=end_time,
                    status_code=current_status_code,
                    status_message="",
                    attributes=attributes,
                    events=events,
                )
        else:
            return request_fn(*args, **kwargs)

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


def _output_value(response: "ChatCompletion") -> str:
    return json.dumps(response)


def _output_mime_type(_: Any) -> MimeType:
    return MimeType.JSON


def _llm_output_messages(response: "ChatCompletion") -> List[OpenInferenceMessage]:
    return [
        _to_openinference_message(choice["message"], expects_name=False)
        for choice in response["choices"]
    ]


def _llm_token_count_prompt(response: "ChatCompletion") -> Optional[int]:
    if token_usage := response.get("usage"):
        return cast(int, token_usage["prompt_tokens"])
    return None


def _llm_token_count_completion(response: "ChatCompletion") -> Optional[int]:
    if token_usage := response.get("usage"):
        return cast(int, token_usage["completion_tokens"])
    return None


def _llm_token_count_total(response: "ChatCompletion") -> Optional[int]:
    if token_usage := response.get("usage"):
        return cast(int, token_usage["total_tokens"])
    return None


def _llm_function_call(
    response: "ChatCompletion",
) -> Optional[str]:
    choices = response["choices"]
    choice = choices[0]
    if choice.get("finish_reason") == "function_call" and (
        function_call_data := choice["message"].get("function_call")
    ):
        return json.dumps(function_call_data)
    return None


def _get_request_type(url: str) -> Optional[RequestType]:
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
    if expects_name and (name := message.get("name")):
        openinference_message[MESSAGE_NAME] = name
    return openinference_message


_PARAMETER_ATTRIBUTE_FUNCTIONS: Dict[str, Callable[[Parameters], Any]] = {
    INPUT_VALUE: _input_value,
    INPUT_MIME_TYPE: _input_mime_type,
    LLM_INPUT_MESSAGES: _llm_input_messages,
    LLM_INVOCATION_PARAMETERS: _llm_invocation_parameters,
}
_RESPONSE_ATTRIBUTE_FUNCTIONS: Dict[str, Callable[["ChatCompletion"], Any]] = {
    OUTPUT_VALUE: _output_value,
    OUTPUT_MIME_TYPE: _output_mime_type,
    LLM_OUTPUT_MESSAGES: _llm_output_messages,
    LLM_TOKEN_COUNT_PROMPT: _llm_token_count_prompt,
    LLM_TOKEN_COUNT_COMPLETION: _llm_token_count_completion,
    LLM_TOKEN_COUNT_TOTAL: _llm_token_count_total,
    LLM_FUNCTION_CALL: _llm_function_call,
}
