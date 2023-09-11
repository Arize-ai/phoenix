import json
import uuid
from datetime import datetime
from typing import Iterator, List, Optional, cast

import pandas as pd
from pandas import DataFrame, read_parquet

from phoenix.datetime_utils import normalize_timestamps

from ..config import DATASET_DIR, GENERATED_DATASET_NAME_PREFIX
from .schemas import ATTRIBUTE_PREFIX, CONTEXT_PREFIX, Span
from .span_json_decoder import json_to_span
from .span_json_encoder import span_to_json

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


def normalize_dataframe(dataframe: DataFrame) -> "DataFrame":
    """Makes the dataframe have appropriate data types"""

    # Convert the start and end times to datetime
    dataframe["start_time"] = normalize_timestamps(dataframe["start_time"])
    dataframe["end_time"] = normalize_timestamps(dataframe["end_time"])
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

    name: str
    dataframe: pd.DataFrame
    _data_file_name: str = "data.parquet"

    def __init__(self, dataframe: DataFrame, name: Optional[str] = None):
        # Validate the the dataframe has required fields
        if missing_columns := set(REQUIRED_COLUMNS) - set(dataframe.columns):
            raise ValueError(
                f"The dataframe is missing some required columns: {', '.join(missing_columns)}"
            )
        self.dataframe = normalize_dataframe(dataframe)
        self.name = name or f"{GENERATED_DATASET_NAME_PREFIX}{str(uuid.uuid4())}"

    @classmethod
    def from_spans(cls, spans: List[Span]) -> "TraceDataset":
        """Creates a TraceDataset from a list of spans.

        Args:
            spans (List[Span]): A list of spans.

        Returns:
            TraceDataset: A TraceDataset containing the spans.
        """
        return cls(pd.json_normalize(map(json.loads, map(span_to_json, spans))))  # type: ignore

    def to_spans(self) -> Iterator[Span]:
        for _, row in self.dataframe.iterrows():
            is_attribute = row.index.str.startswith(ATTRIBUTE_PREFIX)
            attribute_keys = row.index[is_attribute]
            attributes = (
                row.loc[is_attribute]
                .rename(
                    {key: key[len(ATTRIBUTE_PREFIX) :] for key in attribute_keys},
                )
                .dropna()
                .to_dict()
            )
            is_context = row.index.str.startswith(CONTEXT_PREFIX)
            context_keys = row.index[is_context]
            context = (
                row.loc[is_context]
                .rename(
                    {key: key[len(CONTEXT_PREFIX) :] for key in context_keys},
                )
                .to_dict()
            )
            yield json_to_span(
                {
                    "name": row["name"],
                    "context": context,
                    "span_kind": row["span_kind"],
                    "parent_id": row["parent_id"],
                    "start_time": cast(datetime, row["start_time"]).isoformat(),
                    "end_time": None if not (end_time := row["end_time"]) else end_time.isoformat(),
                    "status_code": row["status_code"],
                    "status_message": row["status_message"],
                    "attributes": attributes,
                    "events": row["events"],
                    "conversation": row["conversation"],
                }
            )

    @classmethod
    def from_name(cls, name: str) -> "TraceDataset":
        """Retrieves a dataset by name from the file system"""
        directory = DATASET_DIR / name
        df = read_parquet(directory / cls._data_file_name)
        return cls(df, name)

    def to_disc(self) -> None:
        """writes the data to disc"""
        directory = DATASET_DIR / self.name
        directory.mkdir(parents=True, exist_ok=True)
        self.dataframe.to_parquet(
            directory / self._data_file_name,
            allow_truncated_timestamps=True,
            coerce_timestamps="ms",
        )
