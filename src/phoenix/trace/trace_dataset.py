from enum import Enum

import pandas as pd
from pandas import DataFrame

# A set of columns that is required
REQUIRED_COLUMNS = [
    "name",
    "span_kind",
    "parent_id",
    "start_time",
    "end_time",
    "status_code",
    "status_message",
    "context.span_id",
    "context.trace_id",
]


class ComputedColumns(Enum):
    "The latency of the span in milliseconds"
    latency_ms = "latency_ms"


def normalize_dataframe(dataframe: DataFrame) -> "DataFrame":
    """Makes the dataframe have appropriate data types"""

    # Convert the start and end times to datetime
    dataframe["start_time"] = pd.to_datetime(dataframe["start_time"])
    dataframe["end_time"] = pd.to_datetime(dataframe["end_time"])

    # Computed columns
    dataframe[ComputedColumns.latency_ms.value] = (
        dataframe["end_time"] - dataframe["start_time"]
    ).astype("timedelta64[ms]")

    return dataframe


class TraceDataset:
    """
    A TraceDataset is a wrapper around a dataframe which is a flattened representation
    of Spans. The collection of spans trace the LLM application's execution.

    Parameters
    __________
    dataframe: pandas.DataFrame
        the pandas dataframe containing the tracing data. Each row represents a span.
    """

    dataframe: pd.DataFrame

    def __init__(self, dataframe: DataFrame):
        # Validate the the dataframe has required fields
        if missing_columns := set(REQUIRED_COLUMNS) - set(dataframe.columns):
            raise ValueError(
                f"The dataframe is missing some required columns: {', '.join(missing_columns)}"
            )
        self.dataframe = normalize_dataframe(dataframe)
