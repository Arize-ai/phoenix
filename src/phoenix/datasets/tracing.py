from __future__ import annotations

from binascii import hexlify
from contextlib import contextmanager
from contextvars import ContextVar
from threading import Lock
from typing import (
    Any,
    Callable,
    Iterator,
    Optional,
)

from openinference.semconv.resource import ResourceAttributes
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.id_generator import RandomIdGenerator
from opentelemetry.trace import INVALID_TRACE_ID, SpanContext
from wrapt import apply_patch, resolve_path, wrap_function_wrapper

from phoenix.datasets.types import TraceId


class TraceStealer:
    __slots__ = ("_trace_id", "_trace_found", "_resource")

    def __init__(self, project_name: Optional[str] = None) -> None:
        self._trace_id: int = _ID_GEN.generate_trace_id()
        self._trace_found = False
        self._resource = (
            Resource.create({ResourceAttributes.PROJECT_NAME: project_name})
            if project_name
            else None
        )

    @property
    def trace_id(self) -> Optional[TraceId]:
        if self._trace_found:
            return _str_trace_id(self._trace_id)
        return None

    def mutate(self, span: ReadableSpan) -> None:
        if (ctx := span._context) is None or ctx.span_id == INVALID_TRACE_ID:
            return
        self._trace_found = True
        span._context = SpanContext(
            span_id=ctx.span_id,
            trace_id=self._trace_id,
            is_remote=ctx.is_remote,
            trace_flags=ctx.trace_flags,
            trace_state=ctx.trace_state,
        )
        if self._resource:
            span._resource = span._resource.merge(self._resource)


_ACTIVE_STEALER: ContextVar[Optional[TraceStealer]] = ContextVar("active_stealer")


def hijack_span(init: Callable[..., None], span: ReadableSpan, args: Any, kwargs: Any) -> None:
    init(*args, **kwargs)
    if isinstance(ts := _ACTIVE_STEALER.get(None), TraceStealer):
        ts.mutate(span)


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
                module=_SPAN_INIT_MODULE, name=_SPAN_INIT_NAME, wrapper=hijack_span
            )
    yield
    with _SPAN_INIT_MONKEY_PATCH_LOCK:
        _SPAN_INIT_MONKEY_PATCH_COUNT -= 1
        if _SPAN_INIT_MONKEY_PATCH_COUNT == 0:
            apply_patch(_SPAN_INIT_PARENT, _SPAN_INIT_ATTR, _SPAN_INIT_ORIGINAL)


@contextmanager
def trace_stealing(project_name: Optional[str] = None) -> Iterator[TraceStealer]:
    ts = TraceStealer(project_name)
    with _monkey_patch_span_init():
        token = _ACTIVE_STEALER.set(ts)
        yield ts
        _ACTIVE_STEALER.reset(token)


_ID_GEN = RandomIdGenerator()


def _str_trace_id(id_: int) -> str:
    return hexlify(id_.to_bytes(16, "big")).decode()
