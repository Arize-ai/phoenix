import datetime
import importlib
from inspect import signature
from types import ModuleType
from typing import TYPE_CHECKING, Any, Callable, Optional

from phoenix.trace.schemas import SpanAttributes, SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import (LLM_INPUT_MESSAGES,
                                                LLM_INVOCATION_PARAMETERS,
                                                LLM_MODEL_NAME,
                                                LLM_OUTPUT_MESSAGES,
                                                MESSAGE_CONTENT, MESSAGE_ROLE)

from ..tracer import Tracer

if TYPE_CHECKING:
    from openai.openai_object import OpenAIObject


class OpenAIInstrumentor:
    def __init__(self, tracer: Optional[Tracer] = None) -> None:
        self._tracer = tracer or Tracer()
        self._openai = _import_package("openai")

    def instrument(self) -> None:
        self._openai.api_requestor.APIRequestor.request = _wrap_openai_api_requestor(
            self._openai.api_requestor.APIRequestor.request, self._tracer
        )


def _wrap_openai_api_requestor(
    request_fn: Callable[..., "OpenAIObject"], tracer: Tracer
) -> Callable[..., "OpenAIObject"]:
    INPUT_MESSAGE_KEYMAP = {"content": MESSAGE_CONTENT, "role": MESSAGE_ROLE}

    def wrapped(*args: Any, **kwargs: Any) -> "OpenAIObject":
        call_signature = signature(request_fn)
        bound_args = call_signature.bind(*args, **kwargs)
        raw_params = bound_args.arguments.get("params", dict())
        raw_messages = raw_params["messages"]
        inputs = [
            {INPUT_MESSAGE_KEYMAP[k]: v for k, v in message.items()} for message in raw_messages
        ]

        start_time = datetime.datetime.now()
        attributes = {
            LLM_INPUT_MESSAGES: inputs,
        }
        try:
            output_vals = request_fn(*args, **kwargs)
        except Exception as e:
            exc = e  # maybe pre-allocate exc so we don't populate things that depend on it
        finally:
            tracer.create_span(
                name="OpenAI ChatCompletion Request",
                span_kind=SpanKind.LLM,
                start_time=start_time,
                end_time=datetime.datetime.now(),
                status_code=SpanStatusCode.UNSET,
                status_message="",
                attributes=attributes,
                events=None,
            )
        return output_vals  # return something sensible if output_vals is not defined

    return wrapped


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
