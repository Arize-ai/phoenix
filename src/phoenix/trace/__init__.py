import contextlib
from typing import Iterator

from .projects import using_project
from .span_evaluations import DocumentEvaluations, Evaluations, SpanEvaluations, TraceEvaluations
from .trace_dataset import TraceDataset

__all__ = [
    "Evaluations",
    "TraceDataset",
    "SpanEvaluations",
    "DocumentEvaluations",
    "TraceEvaluations",
    "using_project",
]


@contextlib.contextmanager
def suppress_tracing() -> Iterator[None]:
    """Context manager to pause OpenTelemetry instrumentation."""
    try:
        from opentelemetry.context import _SUPPRESS_INSTRUMENTATION_KEY, attach, detach, set_value
    except ImportError:
        yield
        return
    token = attach(set_value(_SUPPRESS_INSTRUMENTATION_KEY, True))
    yield
    detach(token)
