from datetime import datetime
from uuid import uuid4

from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanException,
    SpanKind,
    SpanStatusCode,
)


def test_span_construction() -> None:
    span = Span(
        name="test",
        parent_id=None,
        start_time=datetime.now(),
        end_time=datetime.now(),
        span_kind=SpanKind.TOOL,
        status_code=SpanStatusCode.OK,
        status_message="",
        attributes={},
        events=[],
        context=SpanContext(trace_id=str(uuid4()), span_id=str(uuid4())),
        conversation=None,
    )
    assert span.name == "test"


def test_span_with_exception() -> None:
    span = Span(
        name="exception-span",
        parent_id=None,
        start_time=datetime.now(),
        end_time=datetime.now(),
        span_kind=SpanKind.TOOL,
        status_code=SpanStatusCode.OK,
        status_message="",
        attributes={},
        events=[SpanException(timestamp=datetime.now(), message="")],
        context=SpanContext(trace_id=str(uuid4()), span_id=str(uuid4())),
        conversation=None,
    )
    assert span.name == "exception-span"
    assert span.events[0].name == "exception"
