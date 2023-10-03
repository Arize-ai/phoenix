import datetime
import json
from enum import Enum
from inspect import signature
from typing import Any, Callable, Dict, Iterator, List, Optional, Tuple

from phoenix.trace.schemas import (
    AttributePrimitiveValue,
    SpanAttributes,
    SpanEvent,
    SpanException,
    SpanKind,
    SpanStatusCode,
)
from phoenix.trace.semantic_conventions import (
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
)
from phoenix.trace.utils import get_stacktrace, import_package

from ..tracer import Tracer


class RequestType(Enum):
    CHAT_COMPLETION = "chat_completion"
    COMPLETION = "completion"
    EMBEDDING = "embedding"


class OpenAIInstrumentor:
    def __init__(self, tracer: Optional[Tracer] = None) -> None:
        self._tracer = tracer or Tracer()

    def instrument(self) -> None:
        """
        Instruments your OpenAI client to automatically create spans for each API call.
        """
        openai = import_package("openai")
        openai.api_requestor.APIRequestor.request = _wrap_openai_api_requestor(
            openai.api_requestor.APIRequestor.request, self._tracer
        )


def _wrap_openai_api_requestor(
    request_fn: Callable[..., Any], tracer: Tracer
) -> Callable[..., Any]:
    # @wrapt.decorator
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        call_signature = signature(request_fn)
        bound_arguments = call_signature.bind(*args, **kwargs)
        parameters = bound_arguments.arguments["params"]
        url = bound_arguments.arguments["url"]
        if _get_request_type(url) is RequestType.CHAT_COMPLETION:
            current_status_code = SpanStatusCode.UNSET
            start_time = datetime.datetime.now()
            events: List[SpanEvent] = []
            attributes: SpanAttributes = {}
            attributes.update(_input_messages(parameters))
            attributes.update(_invocation_parameters(parameters))
            try:
                outputs = request_fn(*args, **kwargs)
                response = outputs[0]
                attributes.update(_token_counts(response))
                attributes.update(_function_calls(response))
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


# def _input(parameters: Dict[str, Any]) -> Iterator[Tuple[str, List[AttributePrimitiveValue]]]:
#     """Yield input messages if present"""
#     if messages := parameters.get("messages"):
#         yield INPUT_VALUE, [_get_openinference_message(message) for message in messages]


def _input_messages(
    parameters: Dict[str, Any]
) -> Iterator[Tuple[str, List[AttributePrimitiveValue]]]:
    """Yields inputs messages if present"""
    if messages := parameters.get("messages"):
        yield LLM_INPUT_MESSAGES, [_get_openinference_message(message) for message in messages]


def _get_openinference_message(message: Dict[str, Any]) -> Dict[str, Any]:
    openinference_message = {MESSAGE_CONTENT: message["content"], MESSAGE_ROLE: message["role"]}
    if function_call_data := message.get("function_call"):
        openinference_message[MESSAGE_FUNCTION_CALL_NAME] = function_call_data["name"]
        openinference_message[MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON] = function_call_data[
            "arguments"
        ]
    if name := message.get("name"):
        openinference_message[MESSAGE_NAME] = name
    return openinference_message


def _invocation_parameters(
    parameters: Dict[str, Any],
) -> Iterator[Tuple[str, Dict[str, Any]]]:
    """Yields invocation parameters if present"""
    yield LLM_INVOCATION_PARAMETERS, parameters


def _function_calls(
    response: Any,
) -> Iterator[Tuple[str, str]]:
    """Yields function call data if present"""
    openai = import_package("openai")
    if isinstance(response, openai.openai_response.OpenAIResponse) and (
        choices := response.data.get("choices")
    ):
        choice = choices[0]
        if choice.get("finish_reason") == "function_call" and (
            function_call_data := choice["message"].get("function_call")
        ):
            yield LLM_FUNCTION_CALL, json.dumps(function_call_data)


def _token_counts(response: Any) -> Iterator[Tuple[str, int]]:
    """Yields token counts if present"""
    openai = import_package("openai")
    if isinstance(response, openai.openai_response.OpenAIResponse) and (
        token_usage := response.data.get("usage")
    ):
        yield LLM_TOKEN_COUNT_PROMPT, token_usage["prompt_tokens"]
        yield LLM_TOKEN_COUNT_COMPLETION, token_usage["completion_tokens"]
        yield LLM_TOKEN_COUNT_TOTAL, token_usage["total_tokens"]


def _get_request_type(url: str) -> Optional[RequestType]:
    if "chat/completions" in url:
        return RequestType.CHAT_COMPLETION
    if "completions" in url:
        return RequestType.COMPLETION
    if "embeddings" in url:
        return RequestType.EMBEDDING
    return None
