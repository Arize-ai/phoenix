from datetime import datetime
from uuid import uuid4

from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanException,
)


def test_span_construction():
    span = Span(
        name="test",
        parent_id=None,
        start_time=datetime.now(),
        end_time=datetime.now(),
        span_kind="TOOL",
        status_code="OK",
        status_message="",
        attributes={},
        events=[],
        context=SpanContext(trace_id=uuid4(), span_id=uuid4()),
        conversation=None,
    )
    assert span.name == "test"


def test_span_with_exception():
    span = Span(
        name="exception-span",
        parent_id=None,
        start_time=datetime.now(),
        end_time=datetime.now(),
        span_kind="TOOL",
        status_code="OK",
        status_message="",
        attributes={},
        events=[SpanException(timestamp=datetime.now(), message="")],
        context=SpanContext(trace_id=uuid4(), span_id=uuid4()),
        conversation=None,
    )
    assert span.name == "exception-span"
    assert span.events[0].name == "exception"
