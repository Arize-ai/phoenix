import datetime
import importlib
from inspect import signature
from types import ModuleType
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
    LLM_INPUT_MESSAGES,
    LLM_INVOCATION_PARAMETERS,
    MESSAGE_CONTENT,
    MESSAGE_ROLE,
)
from phoenix.trace.utils import get_stacktrace

from ..tracer import Tracer


class OpenAIInstrumentor:
    def __init__(self, tracer: Optional[Tracer] = None) -> None:
        self._tracer = tracer or Tracer()
        self._openai = _import_package("openai")

    def instrument(self) -> None:
        self._openai.api_requestor.APIRequestor.request = _wrap_openai_api_requestor(
            self._openai.api_requestor.APIRequestor.request, self._tracer
        )


def _wrap_openai_api_requestor(
    request_fn: Callable[..., Any], tracer: Tracer
) -> Callable[..., Any]:
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        call_signature = signature(request_fn)
        bound_arguments = call_signature.bind(*args, **kwargs)
        parameters = bound_arguments.arguments.get("params", {})
        current_status_code = SpanStatusCode.UNSET
        start_time = datetime.datetime.now()
        events: List[SpanEvent] = []
        attributes: SpanAttributes = {}
        attributes.update(_input_messages(parameters))
        attributes.update(_invocation_parameters(parameters))
        try:
            response = request_fn(*args, **kwargs)
            current_status_code = SpanStatusCode.OK
            return response
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

    return wrapped


def _input_messages(
    parameters: Dict[str, Any]
) -> Iterator[Tuple[str, List[AttributePrimitiveValue]]]:
    """Yields inputs messages if present"""
    if messages := parameters.get("messages"):
        yield LLM_INPUT_MESSAGES, [
            {MESSAGE_CONTENT: message["content"], MESSAGE_ROLE: message["role"]}
            for message in messages
        ]


def _invocation_parameters(
    parameters: Dict[str, Any],
) -> Iterator[Tuple[str, AttributePrimitiveValue]]:
    """Yields invocation parameters if present"""
    yield LLM_INVOCATION_PARAMETERS, parameters


def _import_package(package_name: str, pypi_name: Optional[str] = None) -> ModuleType:
    """
    Dynamically imports a package.

    Args:
        package_name (str): Name of the package to import.

        pypi_name (Optional[str], optional): Name of the package on PyPI, if different from the
        package name.

    Returns:
        ModuleType: The imported package.
    """
    try:
        return importlib.import_module(package_name)
    except ImportError:
        raise ImportError(
            f"The {package_name} package is not installed. "
            f"Install with `pip install {pypi_name or package_name}`."
        )
