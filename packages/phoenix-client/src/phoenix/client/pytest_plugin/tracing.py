from __future__ import annotations

import json
import logging
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass
from typing import Any, Callable, Iterator, Optional

from opentelemetry.context import Context
from opentelemetry.trace import Status, StatusCode

from phoenix.client.resources.experiments import (
    CHAIN,
    EVALUATOR,
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    JSON,
    OPENINFERENCE_SPAN_KIND,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    _get_tracer,  # pyright: ignore[reportPrivateUsage]
    _str_trace_id,  # pyright: ignore[reportPrivateUsage]
    capture_spans,
)

logger = logging.getLogger(__name__)

_JSON_MIME = JSON.value
_degrade_warned = False


def _warn_degraded(detail: str) -> None:
    """Surface a single visible warning the first time tracing degrades this process."""
    global _degrade_warned
    if _degrade_warned:
        return
    _degrade_warned = True
    logger.warning(
        "Phoenix plugin: tracing degraded; runs/evaluations will not link to traces (%s)",
        detail,
    )


@dataclass
class SpanHandle:
    """Carries the captured ``trace_id`` out of a span context manager."""

    trace_id: Optional[str] = None


@dataclass
class SuiteTracer:
    """Process-local OpenInference tracer for one pytest worker, plus its project resource."""

    tracer: Any
    resource: Any

    @contextmanager
    def chain_span(
        self,
        name: str,
        *,
        input_value: Any,
        output_getter: Callable[[], Any],
        error_getter: Optional[Callable[[], Optional[BaseException]]] = None,
    ) -> Iterator[SpanHandle]:
        """Open a CHAIN span around a test body. ``output_getter`` is read on close so the
        span reflects ``record.output`` set during the test. ``error_getter`` is also read on
        close: pytest's ``hookwrapper`` captures a failing test's exception into the call
        outcome instead of raising it through the ``yield``, so the body never propagates it
        here — ``error_getter`` is how the span learns the test failed."""
        with self._span(name, CHAIN, input_value, output_getter, error_getter) as handle:
            yield handle

    @contextmanager
    def evaluator_span(self, name: str, *, input_value: Any) -> Iterator[SpanHandle]:
        """Open an EVALUATOR span around a genuine evaluator invocation. The evaluator is a
        direct call, so a failure propagates through the body and needs no ``error_getter``."""
        with self._span(name, EVALUATOR, input_value, None, None) as handle:
            yield handle

    @contextmanager
    def _span(
        self,
        name: str,
        span_kind: str,
        input_value: Any,
        output_getter: Optional[Callable[[], Any]],
        error_getter: Optional[Callable[[], Optional[BaseException]]],
    ) -> Iterator[SpanHandle]:
        """Run the body inside a span, swallowing every tracing error so the body always runs
        and its own exception (if any) propagates. The body yields exactly once regardless.

        A failure is detected two ways: a body that *raises* (a direct evaluator call) is
        caught here as ``body_error``; a body whose exception pytest swallows (the test under
        the CHAIN hookwrapper) is recovered via ``error_getter`` on close."""
        handle = SpanHandle()
        stack = ExitStack()
        span: Any = None
        try:
            stack.enter_context(capture_spans(self.resource))
            span = stack.enter_context(self.tracer.start_as_current_span(name, context=Context()))
        except Exception as e:  # noqa: BLE001
            _warn_degraded(repr(e))

        body_error: Optional[BaseException] = None
        try:
            yield handle
        except BaseException as exc:
            body_error = exc
            raise
        finally:
            try:
                if span is not None:
                    output = output_getter() if output_getter is not None else None
                    _set_io(span, input_value, output)
                    span.set_attribute(OPENINFERENCE_SPAN_KIND, span_kind)
                    error = body_error
                    if error is None and error_getter is not None:
                        try:
                            error = error_getter()
                        except Exception:  # noqa: BLE001
                            error = None
                    if error is not None:
                        span.record_exception(error)
                        span.set_status(
                            Status(StatusCode.ERROR, f"{type(error).__name__}: {error}")
                        )
                    else:
                        span.set_status(Status(StatusCode.OK))
                stack.close()
                if span is not None:
                    span_context = span.get_span_context()
                    if span_context is not None and span_context.trace_id != 0:
                        handle.trace_id = _str_trace_id(span_context.trace_id)
            except Exception as e:  # noqa: BLE001
                _warn_degraded(repr(e))


def build_suite_tracer(
    *, project_name: Optional[str], base_url: Optional[str], headers: Optional[dict[str, str]]
) -> Optional[SuiteTracer]:
    """Build a process-local, non-global tracer via the experiments-runner helper.

    Returns ``None`` (with one visible warning) on any failure so callers degrade to no
    spans rather than failing a test.
    """
    if not project_name:
        return None
    try:
        tracer, resource = _get_tracer(project_name, base_url, headers)
    except Exception as e:  # noqa: BLE001
        _warn_degraded(repr(e))
        return None
    return SuiteTracer(tracer=tracer, resource=resource)


def _set_io(span: Any, input_value: Any, output_value: Any) -> None:
    if input_value is not None:
        span.set_attribute(INPUT_VALUE, json.dumps(input_value, ensure_ascii=False, default=str))
        span.set_attribute(INPUT_MIME_TYPE, _JSON_MIME)
    if output_value is None:
        return
    if isinstance(output_value, str):
        span.set_attribute(OUTPUT_VALUE, output_value)
    else:
        span.set_attribute(OUTPUT_VALUE, json.dumps(output_value, ensure_ascii=False, default=str))
        span.set_attribute(OUTPUT_MIME_TYPE, _JSON_MIME)
