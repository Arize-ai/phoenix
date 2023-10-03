import datetime
import json
from enum import Enum
from inspect import signature
from typing import (TYPE_CHECKING, Any, Callable, Dict, Iterable, Iterator,
                    List, Mapping, Optional, Tuple)

from phoenix.trace.schemas import (Message, SpanAttributes, SpanEvent,
                                   SpanException, SpanKind, SpanStatusCode)
from phoenix.trace.semantic_conventions import (
    INPUT_MIME_TYPE, INPUT_VALUE, LLM_FUNCTION_CALL, LLM_INPUT_MESSAGES,
    LLM_INVOCATION_PARAMETERS, LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT, LLM_TOKEN_COUNT_TOTAL, MESSAGE_CONTENT,
    MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON, MESSAGE_FUNCTION_CALL_NAME,
    MESSAGE_NAME, MESSAGE_ROLE, OUTPUT_MIME_TYPE, OUTPUT_VALUE, MimeType)
from phoenix.trace.utils import get_stacktrace, import_package

from ..tracer import Tracer

if TYPE_CHECKING:
    from openai.openai_response import OpenAIResponse


class RequestType(Enum):
    CHAT_COMPLETION = "chat_completion"
    COMPLETION = "completion"
    EMBEDDING = "embedding"


INSTRUMENTED_ATTRIBUTE_NAME = "is_instrumented_with_openinference_tracer"


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
        is_instrumented = getattr(
            openai.api_requestor.APIRequestor.request,
            INSTRUMENTED_ATTRIBUTE_NAME,
            False,
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

            pre_run_attributes = [
                INPUT_VALUE,
                INPUT_MIME_TYPE,
                LLM_INPUT_MESSAGES,
                LLM_INVOCATION_PARAMETERS,
            ]
            for a in pre_run_attributes:
                attributes[a] = OPENINFERENCE_TRANSORMER_MAPPING[a](parameters)

            try:
                outputs = request_fn(*args, **kwargs)
                response = outputs[0]

                # ---
                attributes.update(_outputs(response))
                attributes.update(_token_counts(response))
                attributes.update(_function_calls(response))
                # ---

                current_status_code = SpanStatusCode.OK
                return outputs
            except Exception as error:
                current_status_code = SpanStatusCode.ERROR

                # ---
                events.append(
                    SpanException(
                        message=str(error),
                        timestamp=start_time,
                        exception_type=type(error).__name__,
                        exception_stacktrace=get_stacktrace(error),
                    )
                )
                # ---

                raise
            finally:
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


def _input_value(parameters: Mapping[str, Any]) -> str:
    return json.dumps(parameters.get("messages"))


def _input_mime_type(parameters: Mapping[str, Any]) -> str:
    return MimeType.JSON.value


def _llm_input_messages(parameters: Mapping[str, Any]) -> Iterable[Message]:
    if not (messages := parameters.get("messages")):
        return

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
    parameters: Mapping[str, Any],
) -> str:
    return json.dumps(parameters)


def _outputs(response: "OpenAIResponse") -> Iterator[Tuple[str, str]]:
    """Yield output messages as a JSON string in addition to output mime type"""
    yield OUTPUT_VALUE, json.dumps(response.data["choices"])
    yield OUTPUT_MIME_TYPE, MimeType.JSON.value


def _function_calls(
    response: "OpenAIResponse",
) -> Iterator[Tuple[str, str]]:
    """Yields function call data if present"""
    choices = response.data["choices"]
    choice = choices[0]
    if choice.get("finish_reason") == "function_call" and (
        function_call_data := choice["message"].get("function_call")
    ):
        yield LLM_FUNCTION_CALL, json.dumps(function_call_data)


def _token_counts(response: "OpenAIResponse") -> Iterator[Tuple[str, int]]:
    """Yields token counts if present"""
    if token_usage := response.data.get("usage"):
        yield LLM_TOKEN_COUNT_PROMPT, token_usage["prompt_tokens"]
        yield LLM_TOKEN_COUNT_COMPLETION, token_usage["completion_tokens"]
        yield LLM_TOKEN_COUNT_TOTAL, token_usage["total_tokens"]


def _get_request_type(url: str) -> Optional[RequestType]:
    """Get OpenAI request type from URL, or returns None if the request type cannot be recognized"""
    if "chat/completions" in url:
        return RequestType.CHAT_COMPLETION
    if "completions" in url:
        return RequestType.COMPLETION
    if "embeddings" in url:
        return RequestType.EMBEDDING
    return None


OPENINFERENCE_TRANSORMER_MAPPING: Dict[str, Callable] = {
    INPUT_VALUE: _input_value,
    INPUT_MIME_TYPE: _input_mime_type,
    LLM_INPUT_MESSAGES: _llm_input_messages,
    LLM_INVOCATION_PARAMETERS: _llm_invocation_parameters,
}
