import logging
from binascii import hexlify
from functools import wraps
from inspect import BoundArguments, iscoroutinefunction, signature
from typing import (
    Any,
    Awaitable,
    Callable,
    Mapping,
    Optional,
    Sequence,
    TypeVar,
    Union,
    cast,
    overload,
)

import opentelemetry.trace as trace_api
from openinference.instrumentation import OITracer, TraceConfig
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry.trace import NoOpTracer, Status, StatusCode, Tracer
from opentelemetry.util.types import AttributeValue
from typing_extensions import ParamSpec

logger = logging.getLogger(__name__)


def get_tracer(tracer: Optional[Tracer] = None) -> Tracer:
    """Get a tracer instance for tracing operations.

    This function follows a priority order:
    1. Use the provided Tracer if given
    2. Otherwise, pull from the global tracer provider
    3. Fall back to NoOpTracer if all else fails

    Args:
        tracer (Optional[Tracer]): Optional tracer to use. If None, will use global provider.

    Returns:
        Tracer: A tracer instance.
    """

    try:
        if tracer is None:
            global_tracer_provider = trace_api.get_tracer_provider()
            tracer = global_tracer_provider.get_tracer(__name__)
        if not isinstance(tracer, OITracer):
            return OITracer(tracer, config=TraceConfig())
        return tracer

    except Exception:
        logger.debug("Failed to get tracer, falling back to NoOpTracer")
        return NoOpTracer()


FnParams = ParamSpec("FnParams")
ReturnValue = TypeVar("ReturnValue")


def _format_trace_id(trace_id: int) -> str:
    """Format an integer trace ID to a hex string.

    Args:
        trace_id: The integer trace ID from a span context.

    Returns:
        A hex-encoded string representation of the trace ID.
    """
    return hexlify(trace_id.to_bytes(16, "big")).decode()


@overload
def trace(
    *,
    span_name: Union[str, Callable[[BoundArguments], str], None] = None,
    span_kind: Optional[OpenInferenceSpanKindValues] = None,
    tracer: Optional[Tracer] = None,
    process_input: Optional[Mapping[str, Callable[[BoundArguments], Any]]] = None,
    process_output: Optional[Mapping[str, Callable[[ReturnValue], Any]]] = None,
) -> Callable[[Callable[FnParams, ReturnValue]], Callable[FnParams, ReturnValue]]: ...


@overload
def trace(
    *,
    span_name: Union[str, Callable[[BoundArguments], str], None] = None,
    span_kind: Optional[OpenInferenceSpanKindValues] = None,
    tracer: Optional[Tracer] = None,
    process_input: Optional[Mapping[str, Callable[[BoundArguments], Any]]] = None,
    process_output: Optional[Mapping[str, Callable[[ReturnValue], Any]]] = None,
) -> Callable[
    [Callable[FnParams, Awaitable[ReturnValue]]], Callable[FnParams, Awaitable[ReturnValue]]
]: ...


def trace(
    *,
    span_name: Union[str, Callable[[BoundArguments], str], None] = None,
    span_kind: Optional[OpenInferenceSpanKindValues] = None,
    tracer: Optional[Tracer] = None,
    process_input: Optional[Mapping[str, Callable[[BoundArguments], Any]]] = None,
    process_output: Optional[Mapping[str, Callable[[ReturnValue], Any]]] = None,
) -> Callable[[Callable[FnParams, Any]], Callable[FnParams, Any]]:
    """Trace the decorated function.

    If the decorated function has a `tracer` argument, it will be used to trace the function.
    Otherwise the global TracerProvider will be used.

    If the decorated function has a `trace_id` parameter, it will be automatically injected with
    the hex-encoded trace ID from the span context.

    Args:
        span_name (Optional[str]): The name of the span to trace. If not provided, the function's
            __qualname__ will be used.
        span_kind (Optional[OpenInferenceSpanKindValues]): The kind of span to create.
        tracer (Optional[Tracer]): The tracer to use to trace the function. If not provided, the
            global TracerProvider will be used.
        process_input (Optional[Mapping[str, Callable[[BoundArguments], Any]]]): A mapping of
            attribute names to callables that will be called with the bound arguments to process the
            input arguments.
        process_output (Optional[Mapping[str, Callable[[ReturnValue], Any]]]): A mapping of
            attribute names to callables that will be called with the return value to process the
            output.

    Returns:
        Callable[[Callable[FnParams, Any]], Callable[FnParams, Any]]: A decorator function that
            wraps the input function with tracing capabilities.
    """

    def _decorator(
        func: Callable[FnParams, Any],
    ) -> Callable[FnParams, Any]:
        @wraps(func)
        def _wrapper_sync(*args: FnParams.args, **kwargs: FnParams.kwargs) -> ReturnValue:
            bound: Optional[BoundArguments]
            has_trace_id_param: bool = False
            try:
                sig = signature(func)
                bound = sig.bind_partial(*args, **kwargs)
                try:
                    bound.apply_defaults()
                except Exception:
                    pass
                # Check if function has a trace_id parameter
                has_trace_id_param = "trace_id" in sig.parameters
            except Exception:
                bound = None

            # Determine span name
            _span_name: str
            if callable(span_name):
                _span_name = span_name(bound) if bound is not None else func.__qualname__
            elif span_name is not None:
                _span_name = span_name
            else:
                _span_name = cast(str, getattr(func, "__qualname__", func.__name__))

            tracer_from_args: Optional[Tracer] = None
            if bound is not None:
                maybe_tracer = bound.arguments.get("tracer")
                if isinstance(maybe_tracer, Tracer):
                    tracer_from_args = maybe_tracer

            _tracer = get_tracer(tracer_from_args or tracer)
            function_raised: bool = False
            function_executed: bool = False
            result: Any = None
            try:
                with _tracer.start_as_current_span(_span_name) as span:
                    if span_kind is not None:
                        try:
                            span.set_attribute(
                                SpanAttributes.OPENINFERENCE_SPAN_KIND, span_kind.value
                            )
                        except Exception:
                            pass

                    if process_input is not None and bound is not None:
                        for attr_key, input_mapper_fn in process_input.items():
                            try:
                                value = input_mapper_fn(bound)
                                span.set_attribute(attr_key, _otel_attribute_value(value))
                            except Exception:
                                continue

                    # Inject trace_id if the function has a trace_id parameter
                    if has_trace_id_param:
                        try:
                            span_context = span.get_span_context()
                            if span_context is not None and span_context.trace_id != 0:
                                trace_id_hex = _format_trace_id(span_context.trace_id)
                                kwargs["trace_id"] = trace_id_hex
                        except Exception:
                            # If trace_id injection fails, continue without it
                            pass

                    try:
                        result = func(*args, **kwargs)
                        function_executed = True
                    except Exception as exc:
                        try:
                            span.record_exception(exc)
                            span.set_status(Status(StatusCode.ERROR))
                        except Exception:
                            pass
                        function_raised = True
                        raise

                    if process_output is not None:
                        for attr_key, output_mapper_fn in process_output.items():
                            try:
                                value = output_mapper_fn(result)
                                span.set_attribute(attr_key, _otel_attribute_value(value))
                            except Exception:
                                continue
                    return cast(ReturnValue, result)
            except Exception:
                if function_raised:
                    # Propagate the original function exception unchanged
                    raise
                if function_executed:
                    # If function ran successfully but tracing teardown failed, return its result
                    return cast(ReturnValue, result)
                try:
                    # Tracing failures should not affect business logic; run without tracing
                    return cast(ReturnValue, func(*args, **kwargs))
                except Exception:
                    raise

        @wraps(func)
        async def _wrapper_async(*args: FnParams.args, **kwargs: FnParams.kwargs) -> ReturnValue:
            bound: Optional[BoundArguments]
            has_trace_id_param: bool = False
            try:
                sig = signature(func)
                bound = sig.bind_partial(*args, **kwargs)
                try:
                    bound.apply_defaults()
                except Exception:
                    pass
                # Check if function has a trace_id parameter
                has_trace_id_param = "trace_id" in sig.parameters
            except Exception:
                bound = None

            # Determine span name
            _span_name: str
            if callable(span_name):
                _span_name = span_name(bound) if bound is not None else func.__qualname__
            elif span_name is not None:
                _span_name = span_name
            else:
                _span_name = cast(str, getattr(func, "__qualname__", func.__name__))

            tracer_from_args: Optional[Tracer] = None
            if bound is not None:
                maybe_tracer = bound.arguments.get("tracer")
                if isinstance(maybe_tracer, Tracer):
                    tracer_from_args = maybe_tracer

            _tracer = get_tracer(tracer_from_args or tracer)
            function_raised: bool = False
            function_executed: bool = False
            result: Any = None
            try:
                with _tracer.start_as_current_span(_span_name) as span:
                    if span_kind is not None:
                        try:
                            span.set_attribute(
                                SpanAttributes.OPENINFERENCE_SPAN_KIND, span_kind.value
                            )
                        except Exception:
                            pass

                    if process_input is not None and bound is not None:
                        for attr_key, input_mapper_fn in process_input.items():
                            try:
                                value = input_mapper_fn(bound)
                                span.set_attribute(attr_key, _otel_attribute_value(value))
                            except Exception:
                                continue

                    # Inject trace_id if the function has a trace_id parameter
                    if has_trace_id_param:
                        try:
                            span_context = span.get_span_context()
                            if span_context is not None and span_context.trace_id != 0:
                                trace_id_hex = _format_trace_id(span_context.trace_id)
                                kwargs["trace_id"] = trace_id_hex
                        except Exception:
                            # If trace_id injection fails, continue without it
                            pass

                    try:
                        result = await func(*args, **kwargs)
                        function_executed = True
                    except Exception as exc:
                        try:
                            span.record_exception(exc)
                            span.set_status(Status(StatusCode.ERROR))
                        except Exception:
                            pass
                        function_raised = True
                        raise

                    if process_output is not None:
                        for attr_key, output_mapper_fn in process_output.items():
                            try:
                                value = output_mapper_fn(result)
                                span.set_attribute(attr_key, _otel_attribute_value(value))
                            except Exception:
                                continue
                    return cast(ReturnValue, result)
            except Exception:
                if function_raised:
                    # Propagate the original function exception unchanged
                    raise
                if function_executed:
                    # If function ran successfully but tracing teardown failed, return its result
                    return cast(ReturnValue, result)
                try:
                    # Tracing failures should not affect business logic; run without tracing
                    return cast(ReturnValue, await cast(Callable[..., Any], func)(*args, **kwargs))
                except Exception:
                    raise

        if iscoroutinefunction(func):
            return cast(Callable[FnParams, Any], _wrapper_async)
        return cast(Callable[FnParams, Any], _wrapper_sync)

    return _decorator


def _otel_attribute_value(value: Any) -> AttributeValue:
    """Convert a value to an OpenTelemetry-compatible attribute value.

    Args:
        value (Any): The value to convert.

    Returns:
        AttributeValue: An OpenTelemetry-compatible attribute value.
    """
    if isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        items = cast(Sequence[object], value)
        return [str(item) for item in items]
    return str(value)
