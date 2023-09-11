import json
import math
from base64 import b64encode
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import phoenix.trace.v1.trace_pb2 as pb
import pytz
from google.protobuf.json_format import MessageToDict, MessageToJson, Parse, ParseDict
from google.protobuf.wrappers_pb2 import FloatValue, StringValue
from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanEvent,
    SpanException,
    SpanKind,
    SpanStatusCode,
)
from phoenix.trace.semantic_conventions import (
    DOCUMENT_CONTENT,
    DOCUMENT_ID,
    DOCUMENT_METADATA,
    DOCUMENT_SCORE,
    EMBEDDING_EMBEDDINGS,
    EMBEDDING_MODEL_NAME,
    EMBEDDING_TEXT,
    EMBEDDING_VECTOR,
    EXCEPTION_ESCAPED,
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
    INPUT_VALUE,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    RETRIEVAL_DOCUMENTS,
    DeploymentAttributes,
    MimeType,
)
from phoenix.trace.v1 import decode, encode


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
        attributes={
            DeploymentAttributes.attributes["environment"].id: "dev",
        },
        events=[SpanException(timestamp=datetime.now(), message="")],
        context=SpanContext(trace_id=uuid4(), span_id=uuid4()),
        conversation=None,
    )
    assert span.name == "exception-span"
    assert span.events[0].name == "exception"
    assert span.attributes["deployment.environment"] == "dev"


def test_pb_span_encode_decode():
    trace_id, span_id, parent_span_id = uuid4(), uuid4(), uuid4()
    trace_id_base64 = b64encode(trace_id.bytes).decode("utf-8")
    span_id_base64 = b64encode(span_id.bytes).decode("utf-8")
    parent_span_id_base64 = b64encode(parent_span_id.bytes).decode("utf-8")
    start_time = datetime.now(timezone.utc) - timedelta(weeks=1)
    start_time_rfc3339 = start_time.astimezone(timezone.utc).isoformat()[:-6] + "Z"
    event1_time = datetime.now(pytz.timezone("Asia/Kolkata")) - timedelta(days=1)
    event1_time_rfc3339 = event1_time.astimezone(timezone.utc).isoformat()[:-6] + "Z"
    event2_time = datetime.now(pytz.timezone("Asia/Kolkata")) - timedelta(hours=1)
    event2_time_rfc3339 = event2_time.astimezone(timezone.utc).isoformat()[:-6] + "Z"
    event3_time = datetime.now(pytz.timezone("Asia/Kolkata")) - timedelta(minutes=1)
    event3_time_rfc3339 = event3_time.astimezone(timezone.utc).isoformat()[:-6] + "Z"
    span = Span(
        name="test",
        parent_id=parent_span_id,
        start_time=start_time,
        end_time=None,
        span_kind=SpanKind.TOOL,
        status_code=SpanStatusCode.OK,
        status_message="",
        attributes={
            "0": {"1": [[], 2.0, {"3": [{"4": [5.0, ["6"], 7.0]}, 8.0, [{}], {"9": [10.0]}]}]},
            INPUT_VALUE: "abc",
            OUTPUT_VALUE: json.dumps(
                {"1": [[], 2.0, {"3": [{"4": [5.0, ["6"], 7.0]}, 8.0, [{}]]}]}
            ),
            OUTPUT_MIME_TYPE: MimeType.JSON,
            RETRIEVAL_DOCUMENTS: [
                {
                    DOCUMENT_ID: "123",
                    DOCUMENT_SCORE: 321.0,
                    DOCUMENT_CONTENT: "efg",
                    DOCUMENT_METADATA: {"opq": "rst", "uvw": 567.0},
                },
                {
                    DOCUMENT_ID: "456",
                    DOCUMENT_CONTENT: "hij",
                    "4": [{}, 5.0, [{"6": {}}], 7.0],
                },
            ],
            EMBEDDING_MODEL_NAME: "bcd",
            EMBEDDING_EMBEDDINGS: [
                {
                    EMBEDDING_VECTOR: [9.0, 8.0, 7.0, 6.0],
                },
                {
                    EMBEDDING_VECTOR: [8.0, 7.0, 6.0],
                    EMBEDDING_TEXT: "eight seven six",
                    "5": [6.0, {}, [{"7": {}}], 8.0],
                },
            ],
        },
        events=[
            SpanEvent(timestamp=event1_time, attributes={"3": [{"4": [5.0]}, [{}]]}, name="ijk"),
            SpanException(timestamp=event2_time, message="", exception_escaped=True),
            SpanEvent(timestamp=event3_time, attributes={}, name="jkl"),
        ],
        context=SpanContext(trace_id=trace_id, span_id=span_id),
        conversation=None,
    )
    pb_span = encode(span)
    assert pb_span == encode(decode(pb_span))
    assert decode(pb_span) == replace(
        span,
        start_time=span.start_time.astimezone(timezone.utc),
        events=[
            SpanException(
                timestamp=event.timestamp.astimezone(timezone.utc),
                message=event.attributes.get(EXCEPTION_MESSAGE) or "",
                exception_type=event.attributes.get(EXCEPTION_TYPE),
                exception_escaped=event.attributes.get(EXCEPTION_ESCAPED),
                exception_stacktrace=event.attributes.get(EXCEPTION_STACKTRACE),
            )
            if isinstance(event, SpanException)
            else replace(
                event,
                timestamp=event.timestamp.astimezone(timezone.utc),
            )
            for event in span.events
        ],
    )
    desired_dict = {
        "context": {"traceId": trace_id_base64, "spanId": span_id_base64},
        "parentSpanId": parent_span_id_base64,
        "name": "test",
        "startTime": start_time_rfc3339,
        "status": {"code": "OK"},
        "events": [
            {
                "timestamp": event1_time_rfc3339,
                "name": "ijk",
                "attributes": {"3": [{"4": [5.0]}, [{}]]},
            },
            {"timestamp": event3_time_rfc3339, "name": "jkl"},
        ],
        "exceptions": [{"timestamp": event2_time_rfc3339, "escaped": True}],
        "attributes": {
            "0": {"1": [[], 2.0, {"3": [{"4": [5.0, ["6"], 7.0]}, 8.0, [{}], {"9": [10.0]}]}]}
        },
        "input": {"stringValue": "abc"},
        "output": {"jsonValue": {"1": [[], 2.0, {"3": [{"4": [5.0, ["6"], 7.0]}, 8.0, [{}]]}]}},
        "kind": "TOOL",
        "retrieval": {
            "documents": [
                {
                    "id": "123",
                    "score": 321.0,
                    "content": "efg",
                    "metadata": {"opq": "rst", "uvw": 567.0},
                },
                {
                    "id": "456",
                    "content": "hij",
                    "attributes": {"4": [{}, 5.0, [{"6": {}}], 7.0]},
                },
            ]
        },
        "embedding": {
            "modelName": "bcd",
            "embeddings": [
                {"vector": [9.0, 8.0, 7.0, 6.0]},
                {
                    "vector": [8.0, 7.0, 6.0],
                    "text": "eight seven six",
                    "attributes": {"5": [6.0, {}, [{"7": {}}], 8.0]},
                },
            ],
        },
    }
    desired_pb_span = pb.Span()
    ParseDict(desired_dict, desired_pb_span)
    assert pb_span == desired_pb_span
    del desired_dict, desired_pb_span

    # JSON serialization should work unless there is
    # NaN in un-typed fields of arbitrary structs
    new_span = pb.Span()
    Parse(MessageToJson(pb_span), new_span)
    assert pb_span == new_span
    del new_span

    # Default values should not break.
    empty_pb_span = pb.Span(
        context=pb.Span.Context(
            span_id=uuid4().bytes,
            trace_id=uuid4().bytes,
        )
    )
    assert decode(empty_pb_span) == decode(encode(decode(empty_pb_span)))
    # Note that the default values themselves may not be round-trip-able,
    # i.e. the assert below may or may not work.
    # assert empty_pb_span == encode(decode(empty_pb_span))
    del empty_pb_span


def test_pb_span_update() -> None:
    # end_time
    pb_span = pb.Span()
    assert not pb_span.HasField("end_time")
    pb_span.end_time.FromDatetime(datetime.now())
    assert pb_span.HasField("end_time")
    del pb_span

    # attributes
    pb_span = pb.Span()
    assert not pb_span.HasField("attributes")
    pb_span.attributes["a"] = "b"
    assert pb_span.HasField("attributes")
    assert MessageToDict(pb_span) == {"attributes": {"a": "b"}}
    pb_span.attributes["a"] = {"b": [1, [{"2": [3]}]]}
    assert MessageToDict(pb_span) == {"attributes": {"a": {"b": [1, [{"2": [3]}]]}}}
    del pb_span.attributes["a"]
    assert MessageToDict(pb_span) == {"attributes": {}}
    del pb_span

    # un-typed NaN attribute value - MessageToJson(...) will fail
    pb_span = pb.Span()
    assert not pb_span.HasField("attributes")
    pb_span.attributes["x"] = float("nan")
    assert pb_span.HasField("attributes")
    assert math.isnan(pb_span.attributes["x"])
    # The following is tested to succeed in protobuf==4.24.3
    serialized = pb_span.SerializeToString()
    new_span = pb.Span()
    new_span.ParseFromString(serialized)
    assert math.isnan(new_span.attributes["x"])
    # Serialization of NaN to Dict or JSON is refused in later protobuf versions.
    # See: https://github.com/protocolbuffers/protobuf/issues/11259
    # The following is tested to fail in protobuf==4.24.3
    # assert MessageToDict(pb_span) == {"attributes": {"x": "NaN"}}
    del pb_span, new_span, serialized

    # status
    pb_span = pb.Span()
    assert pb_span.status.code == pb.Span.Status.Code.UNSET
    pb_span.status.code = pb.Span.Status.Code.OK
    assert pb_span.status.code == pb.Span.Status.Code.OK
    assert MessageToDict(pb_span) == {"status": {"code": "OK"}}
    assert not pb_span.status.HasField("message")
    pb_span.status.message.CopyFrom(StringValue(value="bye"))
    assert pb_span.status.HasField("message")
    assert MessageToDict(pb_span) == {"status": {"code": "OK", "message": "bye"}}
    del pb_span

    # retrieval
    pb_span = pb.Span()
    assert not pb_span.HasField("retrieval")
    pb_span.retrieval.documents.append(
        pb.Retrieval.Document(content=StringValue(value="abc")),
    )
    assert pb_span.HasField("retrieval")
    assert MessageToDict(pb_span) == {
        "retrieval": {"documents": [{"content": "abc"}]},
    }
    assert not pb_span.retrieval.documents[0].HasField("metadata")
    pb_span.retrieval.documents[0].metadata["321"] = 123
    assert pb_span.retrieval.documents[0].HasField("metadata")
    assert MessageToDict(pb_span) == {
        "retrieval": {"documents": [{"content": "abc", "metadata": {"321": 123.0}}]},
    }
    # retrieval - NaN score
    pb_span.retrieval.documents[0].score.CopyFrom(FloatValue(value=float("nan")))
    assert math.isnan(pb_span.retrieval.documents[0].score.value)
    assert MessageToDict(pb_span) == {
        "retrieval": {
            "documents": [{"content": "abc", "score": "NaN", "metadata": {"321": 123.0}}]
        },
    }
    new_span = pb.Span()
    Parse(MessageToJson(pb_span), new_span)
    assert math.isnan(new_span.retrieval.documents[0].score.value)
    assert MessageToDict(pb_span) == MessageToDict(new_span)
    assert MessageToJson(pb_span) == MessageToJson(new_span)
    del pb_span, new_span

    # embedding
    pb_span = pb.Span()
    assert not pb_span.HasField("embedding")
    pb_span.embedding.embeddings.append(
        pb.Embedding.Embedding(vector=[2, 3, 4]),
    )
    assert pb_span.HasField("embedding")
    assert MessageToDict(pb_span) == {
        "embedding": {"embeddings": [{"vector": [2.0, 3.0, 4.0]}]},
    }
    assert not pb_span.embedding.embeddings[0].HasField("text")
    pb_span.embedding.embeddings[0].text.CopyFrom(
        StringValue(value="two three four"),
    )
    assert pb_span.embedding.embeddings[0].HasField("text")
    assert MessageToDict(pb_span) == {
        "embedding": {"embeddings": [{"vector": [2.0, 3.0, 4.0], "text": "two three four"}]},
    }
    assert not pb_span.embedding.HasField("model_name")
    pb_span.embedding.model_name.CopyFrom(
        StringValue(value="xyz"),
    )
    assert pb_span.embedding.HasField("model_name")
    assert MessageToDict(pb_span) == {
        "embedding": {
            "embeddings": [{"vector": [2.0, 3.0, 4.0], "text": "two three four"}],
            "modelName": "xyz",
        },
    }
    # embedding - float-typed array with NaN
    pb_span.embedding.embeddings[0].vector.append(float("nan"))
    assert MessageToDict(pb_span) == {
        "embedding": {
            "embeddings": [{"vector": [2.0, 3.0, 4.0, "NaN"], "text": "two three four"}],
            "modelName": "xyz",
        },
    }
    new_span = pb.Span()
    Parse(MessageToJson(pb_span), new_span)
    assert math.isnan(pb_span.embedding.embeddings[0].vector[-1])
    assert MessageToDict(pb_span) == MessageToDict(new_span)
    assert MessageToJson(pb_span) == MessageToJson(new_span)
    del pb_span, new_span
