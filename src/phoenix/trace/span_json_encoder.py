import json
from dataclasses import asdict
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

import numpy as np

from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanConversationAttributes,
    SpanEvent,
)


class SpanJSONEncoder(json.JSONEncoder):
    def default(self, o: Any) -> Any:
        if isinstance(o, UUID):
            return str(o)
        elif isinstance(o, datetime):
            return o.isoformat()
        elif isinstance(o, Enum):
            return o.value
        elif isinstance(o, SpanContext):
            return asdict(o)
        elif isinstance(o, SpanEvent):
            return {
                "name": o.name,
                "attributes": o.attributes,
                "timestamp": o.timestamp.isoformat(),
            }
        elif isinstance(o, Span):
            return {
                "name": o.name,
                "context": o.context,
                "span_kind": o.span_kind,
                "parent_id": o.parent_id,
                "start_time": o.start_time,
                "end_time": o.end_time,
                "status_code": o.status_code,
                "status_message": o.status_message,
                "attributes": o.attributes,
                "events": [self.default(event) for event in o.events],
                "conversation": o.conversation,
            }
        elif isinstance(o, SpanConversationAttributes):
            return {"conversation_id": str(o.conversation_id)}
        elif isinstance(o, np.ndarray):
            return list(o)
        elif isinstance(o, np.integer):
            return int(o)
        elif isinstance(o, np.floating):
            return float(o)
        return super().default(o)


def span_to_json(span: Span) -> str:
    return json.dumps(span, cls=SpanJSONEncoder)


def spans_to_jsonl(spans: list[Span]) -> str:
    return "\n".join(span_to_json(span) for span in spans)
