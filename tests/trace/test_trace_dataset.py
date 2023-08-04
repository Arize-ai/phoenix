from datetime import datetime

import pandas as pd
import pytest
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
