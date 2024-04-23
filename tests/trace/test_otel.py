import json
from dataclasses import replace
from datetime import datetime, timezone
from random import random

import numpy as np
import opentelemetry.proto.trace.v1.trace_pb2 as otlp
import pytest
from google.protobuf.json_format import MessageToJson
from openinference.semconv.trace import (
    SpanAttributes,
)
from opentelemetry.proto.common.v1.common_pb2 import AnyValue, ArrayValue, KeyValue
from phoenix.trace.otel import (
    _decode_identifier,
    _encode_identifier,
    decode_otlp_span,
    encode_span_to_otlp,
)
from phoenix.trace.schemas import (
    EXCEPTION_ESCAPED,
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
    Span,
    SpanContext,
    SpanEvent,
    SpanException,
    SpanKind,
    SpanStatusCode,
)
from pytest import approx

OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND


def test_decode_encode(span):
    otlp_span = encode_span_to_otlp(span)
    assert otlp_span.name == "test_span"
    assert otlp_span.trace_id == _encode_identifier(span.context.trace_id)
    assert otlp_span.span_id == _encode_identifier(span.context.span_id)
    assert otlp_span.parent_span_id == _encode_identifier(span.parent_id)
    assert approx(otlp_span.start_time_unix_nano / 1e9) == span.start_time.timestamp()
    assert approx(otlp_span.end_time_unix_nano / 1e9) == span.end_time.timestamp()
    assert set(map(MessageToJson, otlp_span.attributes)) == {
        MessageToJson(
            KeyValue(
                key=OPENINFERENCE_SPAN_KIND,
                value=AnyValue(string_value="LLM"),
            )
        )
    }
    assert otlp_span.status.code == otlp.Status.StatusCode.STATUS_CODE_ERROR
    assert otlp_span.status.message == "xyz"

    decoded_span = decode_otlp_span(otlp_span)
    assert decoded_span.context.trace_id == _decode_identifier(
        _encode_identifier(span.context.trace_id)
    )
    assert decoded_span.context.span_id == _decode_identifier(
        _encode_identifier(span.context.span_id)
    )
    assert decoded_span.parent_id == _decode_identifier(_encode_identifier(span.parent_id))
    assert decoded_span.attributes == span.attributes
    assert decoded_span.events == span.events
    assert decoded_span.status_code == span.status_code
    assert decoded_span.status_message == span.status_message
    assert decoded_span.start_time == span.start_time
    assert decoded_span.end_time == span.end_time


@pytest.mark.parametrize(
    "span_status_code,otlp_status_code",
    [
        (SpanStatusCode.OK, otlp.Status.StatusCode.STATUS_CODE_OK),
        (SpanStatusCode.ERROR, otlp.Status.StatusCode.STATUS_CODE_ERROR),
        (SpanStatusCode.UNSET, otlp.Status.StatusCode.STATUS_CODE_UNSET),
    ],
)
def test_decode_encode_status_code(span, span_status_code, otlp_status_code):
    span = replace(span, status_code=span_status_code)
    otlp_span = encode_span_to_otlp(span)
    assert otlp_span.status.code == otlp_status_code
    decoded_span = decode_otlp_span(otlp_span)
    assert decoded_span.status_code == span.status_code


@pytest.mark.parametrize("span_kind", list(SpanKind))
def test_decode_encode_span_kind(span, span_kind):
    span = replace(span, span_kind=span_kind)
    span = replace(
        span,
        span_kind=span_kind,
        attributes={"openinference": {"span": {"kind": span_kind.value}}},
    )
    otlp_span = encode_span_to_otlp(span)
    assert MessageToJson(
        KeyValue(
            key=OPENINFERENCE_SPAN_KIND,
            value=AnyValue(string_value=span_kind.value),
        )
    ) in set(map(MessageToJson, otlp_span.attributes))
    decoded_span = decode_otlp_span(otlp_span)
    assert decoded_span.span_kind == span.span_kind


@pytest.mark.parametrize(
    "attributes,otlp_key_value",
    [
        ({"k0": "1"}, KeyValue(key="k0", value=AnyValue(string_value="1"))),
        ({"k1": True}, KeyValue(key="k1", value=AnyValue(bool_value=True))),
        ({"k2": 3}, KeyValue(key="k2", value=AnyValue(int_value=3))),
        ({"k3": 4.0}, KeyValue(key="k3", value=AnyValue(double_value=4.0))),
        (
            {"k4": ["11"]},
            KeyValue(
                key="k4",
                value=AnyValue(array_value=ArrayValue(values=[AnyValue(string_value="11")])),
            ),
        ),
        (
            {"k5": [True]},
            KeyValue(
                key="k5",
                value=AnyValue(array_value=ArrayValue(values=[AnyValue(bool_value=True)])),
            ),
        ),
        (
            {"k6": [33]},
            KeyValue(
                key="k6",
                value=AnyValue(array_value=ArrayValue(values=[AnyValue(int_value=33)])),
            ),
        ),
        (
            {"k7": [44.0]},
            KeyValue(
                key="k7",
                value=AnyValue(array_value=ArrayValue(values=[AnyValue(double_value=44.0)])),
            ),
        ),
    ],
)
def test_decode_encode_attributes(span, attributes, otlp_key_value):
    span = replace(span, attributes={**span.attributes, **attributes})
    otlp_span = encode_span_to_otlp(span)
    assert MessageToJson(otlp_key_value) in set(map(MessageToJson, otlp_span.attributes))
    decoded_span = decode_otlp_span(otlp_span)
    assert decoded_span.attributes == span.attributes


def test_decode_encode_events(span):
    event_name = str(random())
    exception_message = str(random())
    exception_type = str(random())
    exception_stacktrace = str(random())
    event_timestamp = datetime(2001, 2, 3, tzinfo=timezone.utc)
    exception_timestamp = datetime(2002, 3, 4, tzinfo=timezone.utc)
    events = [
        SpanEvent(
            name=event_name,
            timestamp=event_timestamp,
            attributes={
                "e0": "11111",
                "e1": True,
                "e2": 33333,
                "e3": 44444.0,
                "e4": ["111111"],
                "e5": [True],
                "e6": [333333],
                "e7": [444444.0],
            },
        ),
        SpanException(
            timestamp=exception_timestamp,
            message=exception_message,
            exception_type=exception_type,
            exception_escaped=True,
            exception_stacktrace=exception_stacktrace,
        ),
    ]
    span = replace(span, events=events)
    otlp_span = encode_span_to_otlp(span)
    event_otlp_attributes = [
        KeyValue(key="e0", value=AnyValue(string_value="11111")),
        KeyValue(key="e1", value=AnyValue(bool_value=True)),
        KeyValue(key="e2", value=AnyValue(int_value=33333)),
        KeyValue(key="e3", value=AnyValue(double_value=44444.0)),
        KeyValue(
            key="e4",
            value=AnyValue(array_value=ArrayValue(values=[AnyValue(string_value="111111")])),
        ),
        KeyValue(
            key="e5",
            value=AnyValue(array_value=ArrayValue(values=[AnyValue(bool_value=True)])),
        ),
        KeyValue(
            key="e6",
            value=AnyValue(array_value=ArrayValue(values=[AnyValue(int_value=333333)])),
        ),
        KeyValue(
            key="e7",
            value=AnyValue(array_value=ArrayValue(values=[AnyValue(double_value=444444.0)])),
        ),
    ]
    exception_otlp_attributes = [
        KeyValue(key=EXCEPTION_TYPE, value=AnyValue(string_value=exception_type)),
        KeyValue(key=EXCEPTION_MESSAGE, value=AnyValue(string_value=exception_message)),
        KeyValue(key=EXCEPTION_ESCAPED, value=AnyValue(bool_value=True)),
        KeyValue(key=EXCEPTION_STACKTRACE, value=AnyValue(string_value=exception_stacktrace)),
    ]
    otlp_events = [
        otlp.Span.Event(
            name=event_name,
            time_unix_nano=int(event_timestamp.timestamp() * 1e9),
            attributes=event_otlp_attributes,
        ),
        otlp.Span.Event(
            name="exception",
            time_unix_nano=int(exception_timestamp.timestamp() * 1e9),
            attributes=exception_otlp_attributes,
        ),
    ]
    assert list(map(MessageToJson, otlp_span.events)) == list(map(MessageToJson, otlp_events))
    decoded_span = decode_otlp_span(otlp_span)
    assert decoded_span.events == span.events


def test_decode_encode_documents(span):
    content = str(random())
    score = random()
    document_metadata = {
        "m0": "111",
        "m1": True,
        "m2": 333,
        "m3": 444.0,
        "m4": ["1111"],
        "m5": [True],
        "m6": [3333],
        "m7": [4444.0],
    }
    attributes = {
        "retrieval": {
            "documents": [
                {"document": {"id": "d1", "content": content, "score": score}},
                {"document": {"id": "d2"}},
                {"document": {"content": content}},
                {"document": {"score": score}},
                {"document": {"metadata": document_metadata}},
            ]
        }
    }
    span = replace(span, attributes=attributes)
    otlp_span = encode_span_to_otlp(span)
    otlp_attributes = [
        KeyValue(
            key=OPENINFERENCE_SPAN_KIND,
            value=AnyValue(string_value="LLM"),
        ),
        KeyValue(
            key="retrieval.documents.0.document.id",
            value=AnyValue(string_value="d1"),
        ),
        KeyValue(
            key="retrieval.documents.0.document.content",
            value=AnyValue(string_value=content),
        ),
        KeyValue(
            key="retrieval.documents.0.document.score",
            value=AnyValue(double_value=score),
        ),
        KeyValue(
            key="retrieval.documents.1.document.id",
            value=AnyValue(string_value="d2"),
        ),
        KeyValue(
            key="retrieval.documents.2.document.content",
            value=AnyValue(string_value=content),
        ),
        KeyValue(
            key="retrieval.documents.3.document.score",
            value=AnyValue(double_value=score),
        ),
        KeyValue(
            key="retrieval.documents.4.document.metadata",
            value=AnyValue(string_value=json.dumps(document_metadata)),
        ),
    ]
    assert set(map(MessageToJson, otlp_span.attributes)) == set(map(MessageToJson, otlp_attributes))
    decoded_span = decode_otlp_span(otlp_span)
    assert (
        decoded_span.attributes["retrieval"]["documents"]
        == span.attributes["retrieval"]["documents"]
    )


def test_decode_encode_embeddings(span):
    text = str(random())
    vector = list(np.random.rand(3))
    attributes = {
        "embedding": {
            "embeddings": [
                {"embedding": {"vector": vector}},
                {"embedding": {"vector": vector, "text": text}},
                {"embedding": {"text": text}},
            ],
        },
    }
    span = replace(span, attributes=attributes)
    otlp_span = encode_span_to_otlp(span)
    vector_otlp_values = [
        AnyValue(double_value=vector[0]),
        AnyValue(double_value=vector[1]),
        AnyValue(double_value=vector[2]),
    ]
    otlp_attributes = [
        KeyValue(
            key=OPENINFERENCE_SPAN_KIND,
            value=AnyValue(string_value="LLM"),
        ),
        KeyValue(
            key="embedding.embeddings.0.embedding.vector",
            value=AnyValue(array_value=ArrayValue(values=vector_otlp_values)),
        ),
        KeyValue(
            key="embedding.embeddings.1.embedding.vector",
            value=AnyValue(array_value=ArrayValue(values=vector_otlp_values)),
        ),
        KeyValue(
            key="embedding.embeddings.1.embedding.text",
            value=AnyValue(string_value=text),
        ),
        KeyValue(
            key="embedding.embeddings.2.embedding.text",
            value=AnyValue(string_value=text),
        ),
    ]
    assert set(map(MessageToJson, otlp_span.attributes)) == set(map(MessageToJson, otlp_attributes))
    decoded_span = decode_otlp_span(otlp_span)
    assert (
        decoded_span.attributes["embedding"]["embeddings"]
        == span.attributes["embedding"]["embeddings"]
    )


def test_decode_encode_message_tool_calls(span):
    attributes = {
        "llm": {
            "output_messages": [
                {"message": {"role": "user"}},
                {
                    "message": {
                        "role": "assistant",
                        "tool_calls": [
                            {
                                "tool_call": {
                                    "function": {
                                        "name": "multiply",
                                        "arguments": '{\n  "a": 2,\n  "b": 3\n}',
                                    },
                                },
                            },
                        ],
                    },
                },
            ],
        },
    }
    span = replace(span, attributes=attributes)
    otlp_span = encode_span_to_otlp(span)
    otlp_attributes = [
        KeyValue(
            key=OPENINFERENCE_SPAN_KIND,
            value=AnyValue(string_value="LLM"),
        ),
        KeyValue(
            key="llm.output_messages.0.message.role",
            value=AnyValue(string_value="user"),
        ),
        KeyValue(
            key="llm.output_messages.1.message.role",
            value=AnyValue(string_value="assistant"),
        ),
        KeyValue(
            key="llm.output_messages.1.message.tool_calls.0.tool_call.function.name",
            value=AnyValue(string_value="multiply"),
        ),
        KeyValue(
            key="llm.output_messages.1.message.tool_calls.0.tool_call.function.arguments",
            value=AnyValue(string_value='{\n  "a": 2,\n  "b": 3\n}'),
        ),
    ]
    assert set(map(MessageToJson, otlp_span.attributes)) == set(map(MessageToJson, otlp_attributes))
    decoded_span = decode_otlp_span(otlp_span)
    assert (
        decoded_span.attributes["llm"]["output_messages"]
        == span.attributes["llm"]["output_messages"]
    )


def test_decode_encode_llm_prompt_template_variables(span):
    attributes = {
        "llm": {"prompt_template": {"variables": {"context_str": "123", "query_str": "321"}}}
    }
    span = replace(span, attributes=attributes)
    otlp_span = encode_span_to_otlp(span)
    otlp_attributes = [
        KeyValue(
            key=OPENINFERENCE_SPAN_KIND,
            value=AnyValue(string_value="LLM"),
        ),
        KeyValue(
            key="llm.prompt_template.variables",
            value=AnyValue(
                string_value=json.dumps(attributes["llm"]["prompt_template"]["variables"])
            ),
        ),
    ]
    assert set(map(MessageToJson, otlp_span.attributes)) == set(map(MessageToJson, otlp_attributes))
    decoded_span = decode_otlp_span(otlp_span)
    assert (
        decoded_span.attributes["llm"]["prompt_template"]["variables"]
        == span.attributes["llm"]["prompt_template"]["variables"]
    )


def test_decode_encode_tool_parameters(span):
    attributes = {
        "tool": {
            "parameters": {
                "title": "multiply",
                "properties": {
                    "a": {"type": "integer", "title": "A"},
                    "b": {"title": "B", "type": "integer"},
                },
                "required": ["a", "b"],
                "type": "object",
            },
        },
    }
    span = replace(span, attributes=attributes)
    otlp_span = encode_span_to_otlp(span)
    otlp_attributes = [
        KeyValue(
            key=OPENINFERENCE_SPAN_KIND,
            value=AnyValue(string_value="LLM"),
        ),
        KeyValue(
            key="tool.parameters",
            value=AnyValue(string_value=json.dumps(attributes["tool"]["parameters"])),
        ),
    ]
    assert set(map(MessageToJson, otlp_span.attributes)) == set(map(MessageToJson, otlp_attributes))
    decoded_span = decode_otlp_span(otlp_span)
    assert decoded_span.attributes["tool"]["parameters"] == span.attributes["tool"]["parameters"]


@pytest.fixture
def span() -> Span:
    trace_id = "f096b681-b8d4-44eb-bc4a-1db0b5a8d556"
    span_id = "828ae989-67b6-45a1-9c2f-d58f0e7977a4"
    parent_id = "7cb52fbe-d459-4b59-88f2-21003e25a7bf"
    start_time = datetime(2021, 12, 1, 0, 0, 10, tzinfo=timezone.utc)
    end_time = datetime(2021, 12, 31, 0, 0, 0, 10, tzinfo=timezone.utc)
    return Span(
        name="test_span",
        context=SpanContext(trace_id=trace_id, span_id=span_id),
        parent_id=parent_id,
        span_kind=SpanKind.LLM,
        start_time=start_time,
        end_time=end_time,
        attributes={"openinference": {"span": {"kind": "LLM"}}},
        status_code=SpanStatusCode.ERROR,
        status_message="xyz",
        events=[],
        conversation=None,
    )
