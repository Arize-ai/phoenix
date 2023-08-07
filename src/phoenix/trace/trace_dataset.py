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
        if missing_columns := set(REQUIRED_COLUMNS) - set(df.columns):
            raise ValueError(f"The dataframe is missing some required columns: {', '.join(missing_columns)}")
        self.dataframe = dataframe
