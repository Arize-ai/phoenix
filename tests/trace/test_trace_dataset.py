from datetime import datetime
from uuid import UUID

import pandas as pd
import pytest
from pandas.testing import assert_frame_equal
from phoenix.datetime_utils import normalize_timestamps
from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanConversationAttributes,
    SpanEvent,
    SpanKind,
    SpanStatusCode,
)
from phoenix.trace.span_evaluations import SpanEvaluations
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
    for column_name in ("start_time", "end_time"):
        expected_dataframe[column_name] = normalize_timestamps(
            expected_dataframe[column_name],
        )
    dataset = TraceDataset.from_spans(spans)
    assert_frame_equal(expected_dataframe, dataset.dataframe[expected_dataframe.columns])


def test_dataset_construction_with_evaluations():
    num_records = 5
    span_ids = [f"span_{index}" for index in range(num_records)]
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
            "context.span_id": span_ids,
        }
    ).set_index("context.span_id", drop=False)
    eval_ds_1 = SpanEvaluations(
        eval_name="fake_eval_1",
        dataframe=pd.DataFrame(
            {
                "context.span_id": span_ids,
                "score": [index for index in range(num_records)],
            }
        ).set_index("context.span_id"),
    )
    eval_ds_2 = SpanEvaluations(
        eval_name="fake_eval_2",
        dataframe=pd.DataFrame(
            {
                "context.span_id": span_ids,
                "score": [index for index in range(num_records)],
            }
        ).set_index("context.span_id"),
    )
    ds = TraceDataset(traces_df, evaluations=[eval_ds_1, eval_ds_2])
    evals_df = ds.get_evals_dataframe()
    assert "eval.fake_eval_1.score" in evals_df.columns
    assert "eval.fake_eval_2.score" in evals_df.columns
    assert len(evals_df) is num_records
    df_with_evals = ds.get_spans_dataframe(include_evaluations=True)
    # Validate that the length of the dataframe is the same
    assert len(df_with_evals) == len(traces_df)
    # Validate that the evaluation columns are present
    assert "eval.fake_eval_1.score" in df_with_evals.columns
    assert "eval.fake_eval_2.score" in df_with_evals.columns
    # Validate that the evaluation column contains the correct values
    assert list(df_with_evals["eval.fake_eval_1.score"]) == list(eval_ds_1.dataframe["score"])
    assert list(df_with_evals["eval.fake_eval_2.score"]) == list(eval_ds_2.dataframe["score"])
    # Validate that the output contains a span_id column
    assert "context.span_id" in df_with_evals.columns
