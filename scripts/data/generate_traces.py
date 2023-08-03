#!/usr/bin/env python3

import itertools
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import uuid4

from phoenix.trace.schemas import (
    AttributeValue,
    Span,
    SpanContext,
    SpanConversationAttributes,
    SpanEvent,
    SpanKind,
    SpanStatusCode,
)
from phoenix.trace.span_json_encoder import spans_to_jsonl


def generate_trace(num_spans: int) -> List[Span]:
    """
    Generate a trace of n Spans with random data, where each span is the parent of the next one.

    Parameters
    ----------
    num_spans : int
        The number of spans to generate.

    Returns
    -------
    list of Span
        A list of n Spans with random data.
    """
    if num_spans <= 0:
        return []

    trace_id = uuid4()
    conversation_id = uuid4()

    spans: List[Span] = []
    for i in range(num_spans):
        parent_id = spans[-1].context.span_id if spans else None
        start_time = (spans[-1].end_time if spans else datetime.now()) + timedelta(
            seconds=random.randint(1, 10)
        )
        end_time = start_time + timedelta(seconds=random.randint(1, 600))
        span_id = uuid4()
        span_kind = random.choice(list(SpanKind))
        status_code = random.choice(list(SpanStatusCode))
        status_message = "OK" if status_code == SpanStatusCode.OK else "Error occurred"
        attributes: Dict[str, AttributeValue] = {
            f"attr_{j}": f"value_{j}" for j in range(random.randint(1, 5))
        }
        events = [
            SpanEvent(
                name=f"event_{j}",
                message=f"message_{j}",
                timestamp=start_time + timedelta(seconds=j),
            )
            for j in range(random.randint(1, 5))
        ]

        span = Span(
            name=f"span_{span_id}",
            context=SpanContext(trace_id=trace_id, span_id=span_id),
            span_kind=span_kind,
            parent_id=parent_id,
            start_time=start_time,
            end_time=end_time,
            status_code=status_code,
            status_message=status_message,
            attributes=attributes,
            events=events,
            conversation=SpanConversationAttributes(conversation_id=conversation_id),
        )
        spans.append(span)

    return spans


def generate_traces(
    num_traces: int, min_trace_length: Optional[int], max_trace_length: Optional[int]
) -> List[Span]:
    """
    Generate a flat list of Spans from i traces, where each trace contains a
    random number of Spans in the range.

    Parameters
    ----------
    i : int
        The number of traces to generate.

    Returns
    -------
    list of Span
        A flat list of Spans .
    """
    min_trace_length = min_trace_length if min_trace_length else 3
    max_trace_length = max_trace_length if max_trace_length else 8
    traces = [
        generate_trace(random.randint(min_trace_length, max_trace_length))
        for _ in range(num_traces)
    ]
    return list(itertools.chain.from_iterable(traces))


def main() -> None:
    # generate traces
    spans = generate_traces(num_traces=1000, min_trace_length=3, max_trace_length=5)

    # serialize each span to ndjson
    jsonl_str = spans_to_jsonl(spans)

    # print the jsonl to stdout
    print(jsonl_str)


if __name__ == "__main__":
    main()
