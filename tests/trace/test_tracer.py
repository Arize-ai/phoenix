from datetime import datetime

from phoenix.trace.exporter import NoOpExporter
from phoenix.trace.schemas import Span, SpanException, SpanStatusCode
from phoenix.trace.span_json_decoder import json_string_to_span
from phoenix.trace.span_json_encoder import spans_to_jsonl
from phoenix.trace.tracer import Tracer


def test_span_construction():
    tracer = Tracer(exporter=NoOpExporter())
    span = tracer.create_span(
        name="test",
        start_time=datetime.now(),
        end_time=datetime.now(),
        span_kind="TOOL",
        status_code="OK",
        status_message="",
    )
    assert span.name == "test"
    assert span.span_kind == "TOOL"
    assert span.context.trace_id is not None
    assert span.context.span_id is not None


def test_span_buffer_accumulation():
    tracer = Tracer(exporter=NoOpExporter())
    tracer.create_span(
        name="test_1",
        start_time=datetime.now(),
        end_time=datetime.now(),
        span_kind="TOOL",
        status_code="OK",
        status_message="",
    )
    assert len(tracer.span_buffer) == 1
    assert tracer.span_buffer[0].name == "test_1"

    tracer.create_span(
        name="test_2",
        start_time=datetime.now(),
        end_time=datetime.now(),
        span_kind="TOOL",
        status_code="ERROR",
        status_message="",
        events=[SpanException(timestamp=datetime.now(), message="")],
        attributes={},
    )

    assert len(tracer.span_buffer) == 2
    assert tracer.span_buffer[1].name == "test_2"

    # Test the output of the JSON encoder
    jsonl = spans_to_jsonl(tracer.span_buffer)
    assert jsonl is not None
    span_json_list = jsonl.split("\n")
    assert len(span_json_list) == 2

    # Validate the first span
    parsed_span_1 = json_string_to_span(span_json_list[0])
    assert parsed_span_1 is not None
    assert isinstance(parsed_span_1, Span)
    assert parsed_span_1.name == "test_1"
    assert parsed_span_1.status_code == SpanStatusCode.OK

    # Validate the second span
    parsed_span_2 = json_string_to_span(span_json_list[1])
    assert parsed_span_2 is not None
    assert isinstance(parsed_span_2, Span)
    assert parsed_span_2.name == "test_2"
    assert parsed_span_2.status_code == SpanStatusCode.ERROR
    assert parsed_span_2.events[0].name == "exception"
    assert parsed_span_2.events[0].attributes == {"exception.message": ""}
    assert parsed_span_2.events[0].timestamp is not None
