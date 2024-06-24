from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from threading import Lock
from typing import Any, Callable, Iterator, Optional

from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.trace import INVALID_TRACE_ID
from wrapt import apply_patch, resolve_path, wrap_function_wrapper


class SpanModifier:
    """
    A class that modifies spans with the specified resource attributes.
    """

    __slots__ = ("_resource",)

    def __init__(self, resource: Resource) -> None:
        self._resource = resource

    def modify_resource(self, span: ReadableSpan) -> None:
        """
        Takes a span and merges in the resource attributes specified in the constructor.

        Args:
          span: ReadableSpan: the span to modify
        """
        if (ctx := span._context) is None or ctx.span_id == INVALID_TRACE_ID:
            return
        span._resource = span._resource.merge(self._resource)


_ACTIVE_MODIFIER: ContextVar[Optional[SpanModifier]] = ContextVar("active_modifier")


def override_span(init: Callable[..., None], span: ReadableSpan, args: Any, kwargs: Any) -> None:
    init(*args, **kwargs)
    if isinstance(span_modifier := _ACTIVE_MODIFIER.get(None), SpanModifier):
        span_modifier.modify_resource(span)


_SPAN_INIT_MONKEY_PATCH_LOCK = Lock()
_SPAN_INIT_MONKEY_PATCH_COUNT = 0
_SPAN_INIT_MODULE = ReadableSpan.__init__.__module__
_SPAN_INIT_NAME = ReadableSpan.__init__.__qualname__
_SPAN_INIT_PARENT, _SPAN_INIT_ATTR, _SPAN_INIT_ORIGINAL = resolve_path(
    _SPAN_INIT_MODULE, _SPAN_INIT_NAME
)


@contextmanager
def _monkey_patch_span_init() -> Iterator[None]:
    global _SPAN_INIT_MONKEY_PATCH_COUNT
    with _SPAN_INIT_MONKEY_PATCH_LOCK:
        _SPAN_INIT_MONKEY_PATCH_COUNT += 1
        if _SPAN_INIT_MONKEY_PATCH_COUNT == 1:
            wrap_function_wrapper(
                module=_SPAN_INIT_MODULE, name=_SPAN_INIT_NAME, wrapper=override_span
            )
    yield
    with _SPAN_INIT_MONKEY_PATCH_LOCK:
        _SPAN_INIT_MONKEY_PATCH_COUNT -= 1
        if _SPAN_INIT_MONKEY_PATCH_COUNT == 0:
            apply_patch(_SPAN_INIT_PARENT, _SPAN_INIT_ATTR, _SPAN_INIT_ORIGINAL)


@contextmanager
def capture_spans(resource: Resource) -> Iterator[SpanModifier]:
    """
    A context manager that captures spans and modifies them with the specified resources.

    Args:
      resource: Resource: The resource to merge into the spans created within the context.

    Returns:
        modifier: Iterator[SpanModifier]: The span modifier that is active within the context.
    """
    modifier = SpanModifier(resource)
    with _monkey_patch_span_init():
        token = _ACTIVE_MODIFIER.set(modifier)
        yield modifier
        _ACTIVE_MODIFIER.reset(token)
