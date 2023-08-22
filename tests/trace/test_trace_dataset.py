from datetime import datetime
from uuid import UUID

import pandas as pd
import pytest
from pandas.testing import assert_frame_equal
from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanConversationAttributes,
    SpanEvent,
    SpanKind,
    SpanStatusCode,
)
from phoenix.trace.trace_dataset import TraceDataset


def test_dataset_construction():
    num_records = 5
    traces_df = pd.DataFrame(
        {
            "name": [f"name_{index}" for index in range(num_records)],
            "span_kind": ["LLM" for index in range(num_records)],
            "parent_id": [None for index in range(num_records)],
            "start_time": [datetime.now() for index in range(num_records)],
            "end_time": [datetime.now() for index in range(num_records)],
            "message": [f"message_{index}" for index in range(num_records)],
            "status_code": ["OK" for index in range(num_records)],
            "status_message": ["" for index in range(num_records)],
            "context.trace_id": [f"trace_{index}" for index in range(num_records)],
            "context.span_id": [f"span_{index}" for index in range(num_records)],
        }
    )
    ds = TraceDataset(traces_df)
    assert isinstance(ds.dataframe, pd.DataFrame)


def test_dataset_validation():
    num_records = 5
    # DataFrame with no span_kind
    traces_df = pd.DataFrame(
        {
            "name": [f"name_{index}" for index in range(num_records)],
            "parent_id": [None for index in range(num_records)],
            "start_time": [datetime.now() for index in range(num_records)],
            "end_time": [datetime.now() for index in range(num_records)],
            "message": [f"message_{index}" for index in range(num_records)],
            "status_code": ["OK" for index in range(num_records)],
            "status_message": ["" for index in range(num_records)],
            "context.trace_id": [f"trace_{index}" for index in range(num_records)],
            "context.span_id": [f"span_{index}" for index in range(num_records)],
        }
    )
    with pytest.raises(ValueError):
        _ = TraceDataset(traces_df)


def test_dataset_construction_from_spans():
    spans = [
        Span(
            name="name-0",
            parent_id=UUID(int=0),
            start_time=datetime(year=2000, month=1, day=1, hour=0, minute=0),
            end_time=datetime(year=2000, month=1, day=1, hour=0, minute=1),
            span_kind=SpanKind.CHAIN,
            status_code=SpanStatusCode.OK,
            status_message="",
            attributes={
                "attribute-0": "attribute-value-0",
                "attribute-1": ["list-attribute-value-0", "list-attribute-value-1"],
            },
            events=[
                SpanEvent(
                    name="event-0",
                    attributes={"message": "event-message-0"},
                    timestamp=datetime(year=2000, month=1, day=1, hour=0, minute=3),
                ),
            ],
            context=SpanContext(trace_id=UUID(int=0), span_id=UUID(int=0)),
            conversation=None,
        ),
        Span(
            name="name-1",
            parent_id=None,
            start_time=datetime(year=2000, month=1, day=1, hour=0, minute=1),
            end_time=datetime(year=2000, month=1, day=1, hour=0, minute=2),
            span_kind=SpanKind.TOOL,
            status_code=SpanStatusCode.ERROR,
            status_message="status-message-1",
            attributes={},
            events=[],
            context=SpanContext(trace_id=UUID(int=1), span_id=UUID(int=1)),
            conversation=SpanConversationAttributes(conversation_id=UUID(int=3)),
        ),
    ]
    expected_dataframe = pd.DataFrame(
        [
            {
                "name": "name-0",
                "parent_id": str(UUID(int=0)),
                "start_time": datetime(year=2000, month=1, day=1, hour=0, minute=0),
                "end_time": datetime(year=2000, month=1, day=1, hour=0, minute=1),
                "span_kind": SpanKind.CHAIN.value,
                "status_code": SpanStatusCode.OK.value,
                "status_message": "",
                "attributes.attribute-0": "attribute-value-0",
                "attributes.attribute-1": ["list-attribute-value-0", "list-attribute-value-1"],
                "context.trace_id": str(UUID(int=0)),
                "context.span_id": str(UUID(int=0)),
                "events": [
                    {
                        "name": "event-0",
                        "attributes": {"message": "event-message-0"},
                        "timestamp": datetime(
                            year=2000, month=1, day=1, hour=0, minute=3
                        ).isoformat(),
                    },
                ],
                "conversation.conversation_id": None,
            },
            {
                "name": "name-1",
                "parent_id": None,
                "start_time": datetime(year=2000, month=1, day=1, hour=0, minute=1),
                "end_time": datetime(year=2000, month=1, day=1, hour=0, minute=2),
                "span_kind": SpanKind.TOOL.value,
                "status_code": SpanStatusCode.ERROR.value,
                "status_message": "status-message-1",
                "attributes.attribute-0": None,
                "attributes.attribute-1": None,
                "context.trace_id": str(UUID(int=1)),
                "context.span_id": str(UUID(int=1)),
                "events": [],
                "conversation.conversation_id": str(UUID(int=3)),
            },
        ]
    )
    dataset = TraceDataset.from_spans(spans)
    assert_frame_equal(expected_dataframe, dataset.dataframe[expected_dataframe.columns])
