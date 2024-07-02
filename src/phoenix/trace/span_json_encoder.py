import json
from dataclasses import asdict
from datetime import datetime
from enum import Enum
from typing import Any, List
from uuid import UUID

import numpy as np

from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanConversationAttributes,
    SpanEvent,
)


class SpanJSONEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, UUID):
            return str(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, Enum):
            return obj.value
        elif isinstance(obj, SpanContext):
            return asdict(obj)
        elif isinstance(obj, SpanEvent):
            return {
                "name": obj.name,
                "attributes": obj.attributes,
                "timestamp": obj.timestamp.isoformat(),
            }
        elif isinstance(obj, Span):
            return {
                "name": obj.name,
                "context": obj.context,
                "span_kind": obj.span_kind,
                "parent_id": obj.parent_id,
                "start_time": obj.start_time,
                "end_time": obj.end_time,
                "status_code": obj.status_code,
                "status_message": obj.status_message,
                "attributes": obj.attributes,
                "events": [self.default(event) for event in obj.events],
                "conversation": obj.conversation,
            }
        elif isinstance(obj, SpanConversationAttributes):
            return {"conversation_id": str(obj.conversation_id)}
        elif isinstance(obj, np.ndarray):
            return list(obj)
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        return super().default(obj)


def span_to_json(span: Span) -> str:
    return json.dumps(span, cls=SpanJSONEncoder)


def spans_to_jsonl(spans: List[Span]) -> str:
    return "\n".join(span_to_json(span) for span in spans)
