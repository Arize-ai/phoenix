import json
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanConversationAttributes,
    SpanEvent,
    SpanException,
    SpanKind,
    SpanStatusCode,
)
from phoenix.trace.semantic_conventions import (
    INPUT_MIME_TYPE,
    OUTPUT_MIME_TYPE,
    MimeType,
)


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

    NB: this function is mainly used for testing purposes. Consider swapping this out for pydantic.
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
            trace_id=UUID(context["trace_id"]),
            span_id=UUID(context["span_id"]),
        )
        parent_id = data.get("parent_id")
        data["parent_id"] = UUID(parent_id) if parent_id else None
        attributes = data.get("attributes")
        data["attributes"] = json_to_attributes(attributes)
        data["start_time"] = datetime.fromisoformat(data["start_time"])
        data["end_time"] = datetime.fromisoformat(data["end_time"])
        data["span_kind"] = SpanKind(data["span_kind"])
        data["status_code"] = SpanStatusCode(data["status_code"])
        data["events"] = [
            SpanException(
                message=event["message"],
                timestamp=datetime.fromisoformat(event["timestamp"]),
            )
            if event["name"] == "exception"
            else SpanEvent(
                name=event["name"],
                message=event["message"],
                timestamp=datetime.fromisoformat(event["timestamp"]),
            )
            for event in data["events"]
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
