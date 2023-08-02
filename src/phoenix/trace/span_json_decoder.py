import json
from datetime import datetime
from typing import Any, Dict

from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanConversationAttributes,
    SpanEvent,
    SpanKind,
    SpanStatusCode,
)


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
        data["context"] = SpanContext(**data["context"])  # Recursively build the SpanContext object
        data["start_time"] = datetime.fromisoformat(data["start_time"])
        data["end_time"] = datetime.fromisoformat(data["end_time"])
        data["span_kind"] = SpanKind(data["span_kind"])
        data["status_code"] = SpanStatusCode(data["status_code"])
        data["events"] = [SpanEvent(**event) for event in data["events"]]  # Build SpanEvent objects
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
