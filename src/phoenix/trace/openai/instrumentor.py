import datetime
import json
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
    Sequence,
    Union,
    cast,
)

from phoenix.trace.schemas import (
    AttributeValue,
    Message,
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
    from openai.openai_response import OpenAIResponse


Parameters = Mapping[str, Any]

INSTRUMENTED_ATTRIBUTE_NAME = "is_instrumented_with_openinference_tracer"


class NotSet:
    """Indicates that no value is to be set for a given attribute."""

    pass


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
            openai.api_requestor.APIRequestor.request,
            INSTRUMENTED_ATTRIBUTE_NAME,
        )
        if not is_instrumented:
            openai.api_requestor.APIRequestor.request = _wrap_openai_api_requestor(
                openai.api_requestor.APIRequestor.request, self._tracer
            )
            setattr(
                openai.api_requestor.APIRequestor.request,
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
        parameters = bound_arguments.arguments["params"]
        url = bound_arguments.arguments["url"]
        if _get_request_type(url) is RequestType.CHAT_COMPLETION:
            current_status_code = SpanStatusCode.UNSET
            start_time = datetime.datetime.now()
            events: List[SpanEvent] = []
            attributes: SpanAttributes = dict()

            for (
                attribute_name,
                get_parameter_attribute_fn,
            ) in _PARAMETER_ATTRIBUTE_FUNCTIONS.items():
                attributes.update(
                    _as_span_attributes(attribute_name, get_parameter_attribute_fn(parameters))
                )
            outputs = None
            try:
                outputs = request_fn(*args, **kwargs)
                current_status_code = SpanStatusCode.OK
                return outputs
            except Exception as error:
                current_status_code = SpanStatusCode.ERROR
                events.append(
                    SpanException(
                        message=str(error),
                        timestamp=start_time,
                        exception_type=type(error).__name__,
                        exception_stacktrace=get_stacktrace(error),
                    )
                )
                raise
            finally:
                if outputs:
                    response = outputs[0]
                    for (
                        attribute_name,
                        get_response_attribute_fn,
                    ) in _RESPONSE_ATTRIBUTE_FUNCTIONS.items():
                        attributes.update(
                            _as_span_attributes(attribute_name, get_response_attribute_fn(response))
                        )
                tracer.create_span(
                    name="openai.ChatCompletion.create",
                    span_kind=SpanKind.LLM,
                    start_time=start_time,
                    end_time=datetime.datetime.now(),
                    status_code=current_status_code,
                    status_message="",
                    attributes=attributes,
                    events=events,
                )
        else:
            return request_fn(*args, **kwargs)

    return wrapped


def _input_value(parameters: Parameters) -> Union[str, NotSet]:
    return json.dumps(messages) if (messages := parameters.get("messages")) else NotSet()


def _input_mime_type(parameters: Parameters) -> str:
    return MimeType.JSON.value


def _llm_input_messages(parameters: Parameters) -> Union[Sequence[Message], NotSet]:
    if not (messages := parameters.get("messages")):
        return NotSet()

    llm_input_messages = []
    for message in messages:
        openinference_message = {MESSAGE_CONTENT: message["content"], MESSAGE_ROLE: message["role"]}
        if function_call_data := message.get("function_call"):
            openinference_message[MESSAGE_FUNCTION_CALL_NAME] = function_call_data["name"]
            openinference_message[MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON] = function_call_data[
                "arguments"
            ]
        if name := message.get("name"):
            openinference_message[MESSAGE_NAME] = name
        llm_input_messages.append(openinference_message)
    return llm_input_messages


def _llm_invocation_parameters(
    parameters: Parameters,
) -> str:
    return json.dumps(parameters)


def _output_value(response: "OpenAIResponse") -> str:
    return json.dumps(response.data["choices"])


def _output_mime_type(response: "OpenAIResponse") -> str:
    return MimeType.JSON.value


def _llm_token_count_prompt(response: "OpenAIResponse") -> Union[int, NotSet]:
    if token_usage := response.data.get("usage"):
        return cast(int, token_usage["prompt_tokens"])
    return NotSet()


def _llm_token_count_completion(response: "OpenAIResponse") -> Union[int, NotSet]:
    if token_usage := response.data.get("usage"):
        return cast(int, token_usage["completion_tokens"])
    return NotSet()


def _llm_token_count_total(response: "OpenAIResponse") -> Union[int, NotSet]:
    if token_usage := response.data.get("usage"):
        return cast(int, token_usage["total_tokens"])
    return NotSet()


def _llm_function_call(
    response: "OpenAIResponse",
) -> Union[str, NotSet]:
    choices = response.data["choices"]
    choice = choices[0]
    if choice.get("finish_reason") == "function_call" and (
        function_call_data := choice["message"].get("function_call")
    ):
        return json.dumps(function_call_data)
    return NotSet()


def _get_request_type(url: str) -> Optional[RequestType]:
    """Get OpenAI request type from URL, or returns None if the request type cannot be recognized"""
    if "chat/completions" in url:
        return RequestType.CHAT_COMPLETION
    if "completions" in url:
        return RequestType.COMPLETION
    if "embeddings" in url:
        return RequestType.EMBEDDING
    return None


def _as_span_attributes(
    attribute_name: str, value: Union[AttributeValue, NotSet]
) -> SpanAttributes:
    if isinstance(value, NotSet):
        return dict()
    return {attribute_name: value}


_PARAMETER_ATTRIBUTE_FUNCTIONS: Dict[str, Callable[[Parameters], Union[NotSet, AttributeValue]]] = {
    INPUT_VALUE: _input_value,
    INPUT_MIME_TYPE: _input_mime_type,
    LLM_INPUT_MESSAGES: _llm_input_messages,
    LLM_INVOCATION_PARAMETERS: _llm_invocation_parameters,
}
_RESPONSE_ATTRIBUTE_FUNCTIONS: Dict[
    str, Callable[["OpenAIResponse"], Union[NotSet, AttributeValue]]
] = {
    OUTPUT_VALUE: _output_value,
    OUTPUT_MIME_TYPE: _output_mime_type,
    LLM_TOKEN_COUNT_PROMPT: _llm_token_count_prompt,
    LLM_TOKEN_COUNT_COMPLETION: _llm_token_count_completion,
    LLM_TOKEN_COUNT_TOTAL: _llm_token_count_total,
    LLM_FUNCTION_CALL: _llm_function_call,
}
