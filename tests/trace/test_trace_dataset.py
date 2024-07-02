import json
import os
from datetime import datetime
from uuid import UUID, uuid4

import pandas as pd
import pyarrow
import pytest
from pandas.testing import assert_frame_equal
from phoenix.datetime_utils import normalize_timestamps
from phoenix.trace.errors import InvalidParquetMetadataError
from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanConversationAttributes,
    SpanEvent,
    SpanKind,
    SpanStatusCode,
)
from phoenix.trace.span_evaluations import SpanEvaluations
from phoenix.trace.trace_dataset import TraceDataset, _parse_schema_metadata
from pyarrow import parquet


def test_trace_dataset_construction():
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


def test_trace_dataset_validation():
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


def test_trace_dataset_construction_from_spans():
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


def test_trace_dataset_construction_with_evaluations():
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


def test_trace_dataset_save_and_load_preserve_values(tmp_path) -> None:
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
    ds = TraceDataset(traces_df, name="trace-dataset-name")

    num_records = 5
    span_ids = [f"span_{index}" for index in range(num_records)]

    eval_ds = SpanEvaluations(
        eval_name="my_eval",
        dataframe=pd.DataFrame(
            {
                "context.span_id": span_ids,
                "label": [str(index) for index in range(num_records)],
                "score": [index for index in range(num_records)],
                "random_column": [index for index in range(num_records)],
            }
        ).set_index("context.span_id"),
    )

    ds.append_evaluations(eval_ds)
    dataset_id = ds.save(tmp_path)

    dataset_path = tmp_path / f"trace_dataset-{dataset_id}.parquet"
    assert dataset_path.exists()

    schema = parquet.read_schema(dataset_path)
    arize_metadata = json.loads(schema.metadata[b"arize"])
    assert arize_metadata == {
        "dataset_id": str(ds._id),
        "dataset_name": "trace-dataset-name",
        "eval_ids": [str(eval_ds.id)],
    }

    table = parquet.read_table(dataset_path)
    dataframe = table.to_pandas()
    assert_frame_equal(ds.dataframe, dataframe)

    read_ds = TraceDataset.load(dataset_id, tmp_path)
    assert read_ds._id == ds._id
    assert_frame_equal(read_ds.dataframe, ds.dataframe)
    assert read_ds.evaluations[0].id == eval_ds.id
    assert_frame_equal(read_ds.evaluations[0].dataframe, eval_ds.dataframe)


def test_trace_dataset_load_logs_warning_when_an_evaluation_cannot_be_loaded(tmp_path):
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
    ds = TraceDataset(traces_df, name="trace-dataset-name")
    num_records = 5
    span_ids = [f"span_{index}" for index in range(num_records)]
    eval_ds = SpanEvaluations(
        eval_name="my_eval",
        dataframe=pd.DataFrame(
            {
                "context.span_id": span_ids,
                "label": [str(index) for index in range(num_records)],
                "score": [index for index in range(num_records)],
                "random_column": [index for index in range(num_records)],
            }
        ).set_index("context.span_id"),
    )
    ds.append_evaluations(eval_ds)
    dataset_id = ds.save(tmp_path)

    dataset_path = tmp_path / f"trace_dataset-{dataset_id}.parquet"
    eval_path = dataset_path.parent / f"evaluations-{eval_ds.id}.parquet"
    assert dataset_path.exists()
    assert eval_path.exists()
    os.remove(eval_path)  # remove the eval file to trigger the warning

    with pytest.warns(UserWarning) as record:
        read_ds = TraceDataset.load(dataset_id, tmp_path)

    assert len(record) > 0
    assert str(record[0].message).startswith("Failed to load"), "unexpected warning message"

    read_ds = TraceDataset.load(dataset_id, tmp_path)
    assert read_ds._id == ds._id
    assert_frame_equal(read_ds.dataframe, ds.dataframe)
    assert read_ds.evaluations == []


def test_trace_dataset_load_raises_error_when_input_id_does_not_match_metadata(tmp_path):
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
    ds = TraceDataset(traces_df, name="trace-dataset-name")
    dataset_id = ds.save(tmp_path)
    updated_id = uuid4()
    (tmp_path / f"trace_dataset-{dataset_id}.parquet").rename(
        tmp_path / f"trace_dataset-{updated_id}.parquet"
    )  # move the file so the metadata id no longer matches the file name

    with pytest.raises(InvalidParquetMetadataError):
        TraceDataset.load(updated_id, tmp_path)


def test_parse_schema_metadata_raises_on_invalid_metadata() -> None:
    schema = pyarrow.schema([pyarrow.field("field", pyarrow.float16())]).with_metadata(
        {
            b"arize": json.dumps(
                {"dataset_id": "not-a-valid-uuid", "dataset_name": "dataset-name", "eval_ids": []}
            ).encode()
        }
    )
    with pytest.raises(InvalidParquetMetadataError):
        _parse_schema_metadata(schema)
