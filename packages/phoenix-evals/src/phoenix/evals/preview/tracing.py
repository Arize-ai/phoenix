import logging
from functools import wraps
from inspect import BoundArguments, signature
from typing import Any, Callable, Mapping, Optional, Sequence, TypeVar, cast

from opentelemetry import trace as trace_api
from opentelemetry.trace import NoOpTracer, Status, StatusCode, Tracer
from opentelemetry.util.types import AttributeValue
from typing_extensions import ParamSpec

logger = logging.getLogger(__name__)


def get_tracer(tracer: Optional[Tracer] = None) -> Tracer:
    """
    1. Use the provided Tracer if given
    2. Otherwise, pull from the global tracer provider
    3. Fall back to NoOpTracer if all else fails
    Args:
        tracer_provider: Optional tracer provider to use. If None, will use global provider.
    Returns:
        A tracer instance
    """

    try:
        if tracer is not None:
            return tracer

        global_tracer_provider = trace_api.get_tracer_provider()
        return global_tracer_provider.get_tracer(__name__)

    except Exception:
        logger.debug("Failed to get tracer, falling back to NoOpTracer")
        return NoOpTracer()


FnParams = ParamSpec("FnParams")
ReturnValue = TypeVar("ReturnValue")


def trace(
    *,
    span_name: Optional[str] = None,
    tracer: Optional[Tracer] = None,
    process_input: Optional[Mapping[str, Callable[[BoundArguments], Any]]] = None,
    process_output: Optional[Mapping[str, Callable[[ReturnValue], Any]]] = None,
) -> Callable[[Callable[FnParams, ReturnValue]], Callable[FnParams, ReturnValue]]:
    """
    Traces the decorated function.

    If the decorated function has a `tracer` argument, it will be used to trace the function.
    Otherwise the global TracerProvider will be used.

    Args:
        span_name: The name of the span to trace. If not provided, the function's __qualname__ will
            be used.
        tracer: The tracer to use to trace the function. If not provided, the global TracerProvider
            will be used.
        process_input: A mapping of attribute names to callables that will be called with the bound
            arguments to process the input.
        process_output: A mapping of attribute names to callables that will be called with the
            return value to process the output.
    """

    def _decorator(
        func: Callable[FnParams, ReturnValue],
    ) -> Callable[FnParams, ReturnValue]:
        @wraps(func)
        def _wrapper(*args: FnParams.args, **kwargs: FnParams.kwargs) -> ReturnValue:
            span_label = (
                span_name
                if span_name is not None
                else cast(str, getattr(func, "__qualname__", func.__name__))
            )
            _span_name: str = span_label

            bound: Optional[BoundArguments]
            try:
                sig = signature(func)
                bound = sig.bind_partial(*args, **kwargs)
                try:
                    bound.apply_defaults()
                except Exception:
                    pass
            except Exception:
                bound = None

            tracer_from_args: Optional[Tracer] = None
            if bound is not None:
                maybe_tracer = bound.arguments.get("tracer")
                if isinstance(maybe_tracer, Tracer):
                    tracer_from_args = maybe_tracer

            _tracer = get_tracer(tracer_from_args or tracer)

            with _tracer.start_as_current_span(_span_name) as span:
                if process_input is not None and bound is not None:
                    for attr_key, input_mapper_fn in process_input.items():
                        try:
                            value = input_mapper_fn(bound)
                            span.set_attribute(attr_key, _otel_attribute_value(value))
                        except Exception:
                            continue
                try:
                    result = func(*args, **kwargs)
                except Exception as exc:
                    span.record_exception(exc)
                    span.set_status(Status(StatusCode.ERROR))
                    raise

                if process_output is not None:
                    for attr_key, output_mapper_fn in process_output.items():
                        try:
                            value = output_mapper_fn(result)
                            span.set_attribute(attr_key, _otel_attribute_value(value))
                        except Exception:
                            continue
                return result

        return cast(Callable[FnParams, ReturnValue], _wrapper)

    return _decorator


def _otel_attribute_value(value: Any) -> AttributeValue:
    if isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        items = cast(Sequence[object], value)
        return [str(item) for item in items]
    return str(value)
