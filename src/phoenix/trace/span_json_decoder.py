import json
from datetime import datetime
from typing import Any, Dict, Optional

from openinference.semconv.trace import SpanAttributes

from phoenix.trace.schemas import (
    EXCEPTION_MESSAGE,
    MimeType,
    Span,
    SpanContext,
    SpanConversationAttributes,
    SpanEvent,
    SpanException,
    SpanID,
    SpanKind,
    SpanStatusCode,
    TraceID,
)

INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE


def json_to_attributes(obj: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if obj is None:
        return {}
    if not isinstance(obj, dict):
        raise ValueError(f"attributes should be dict, but attributes={obj}")
    if mime_type := obj.get(INPUT_MIME_TYPE):
        obj[INPUT_MIME_TYPE] = MimeType(mime_type)
    if mime_type := obj.get(OUTPUT_MIME_TYPE):
        obj[OUTPUT_MIME_TYPE] = MimeType(mime_type)
    return obj


def json_to_span(data: Dict[str, Any]) -> Any:
    """
    A hook for json.loads to convert a dict to a Span object.
    """
    # Check if the dict can be interpreted as a Span
    if set(data.keys()) == {
        "name",
        "context",
        "span_kind",
        "parent_id",
        "start_time",
        "end_time",
        "status_code",
        "status_message",
        "attributes",
        "events",
        "conversation",
    }:
        context = data["context"]
        if not isinstance(context, dict):
            raise ValueError(f"context should be dict, but context={context}")
        data["context"] = SpanContext(
            trace_id=TraceID(context["trace_id"]),
            span_id=SpanID(context["span_id"]),
        )
        parent_id = data.get("parent_id")
        data["parent_id"] = parent_id
        attributes = data.get("attributes")
        data["attributes"] = json_to_attributes(attributes)
        data["start_time"] = datetime.fromisoformat(data["start_time"])
        data["end_time"] = (
            datetime.fromisoformat(end_time) if (end_time := data.get("end_time")) else None
        )
        data["span_kind"] = SpanKind(data["span_kind"])
        data["status_code"] = SpanStatusCode(data["status_code"])
        data["events"] = [
            SpanException(
                message=(event.get("attributes") or {}).get(EXCEPTION_MESSAGE) or "",
                timestamp=datetime.fromisoformat(event["timestamp"]),
            )
            if event["name"] == "exception"
            else SpanEvent(
                name=event["name"],
                attributes=event.get("attributes") or {},
                timestamp=datetime.fromisoformat(event["timestamp"]),
            )
            for event in (
                json.loads(data["events"]) if isinstance(data["events"], str) else data["events"]
            )
        ]
        data["conversation"] = (
            SpanConversationAttributes(**data["conversation"])
            if data["conversation"] is not None
            else None
        )
        return Span(**data)
    return data


def json_string_to_span(json_string: str) -> Span:
    obj = json.loads(json_string, object_hook=json_to_span)
    if not isinstance(obj, Span):
        raise TypeError("Failed to parse JSON string as Span")
    return obj
