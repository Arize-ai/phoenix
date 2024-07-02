import json
from datetime import datetime, timezone

import numpy as np
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode
from phoenix.trace.span_json_encoder import span_to_json


def test_span_to_json() -> None:
    start_time = datetime.now(timezone.utc)
    end_time = datetime.now(timezone.utc)
    span = Span(
        name="test",
        context=SpanContext(
            trace_id="1234",
            span_id="5678",
        ),
        span_kind=SpanKind.UNKNOWN,
        parent_id=None,
        start_time=start_time,
        end_time=end_time,
        status_code=SpanStatusCode.ERROR,
        status_message="error",
        attributes={
            "key": "value",
            "integers": np.array([1, 2, 3]),
            "floats": np.array([0.1, 0.2, 0.3]),
        },
        events=[],
        conversation=None,
    )
    assert json.loads(span_to_json(span)) == {
        "name": "test",
        "context": {
            "trace_id": "1234",
            "span_id": "5678",
        },
        "span_kind": "UNKNOWN",
        "parent_id": None,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "status_code": "ERROR",
        "status_message": "error",
        "attributes": {
            "key": "value",
            "integers": [1, 2, 3],
            "floats": [0.1, 0.2, 0.3],
        },
        "events": [],
        "conversation": None,
    }
