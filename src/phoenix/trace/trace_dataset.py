import json
import uuid
from datetime import datetime
from typing import Iterator, List, Optional, Union, cast

import pandas as pd
from pandas import DataFrame, read_parquet

from phoenix.datetime_utils import normalize_timestamps

from ..config import DATASET_DIR, GENERATED_DATASET_NAME_PREFIX
from .schemas import ATTRIBUTE_PREFIX, CONTEXT_PREFIX, Span
from .span_json_decoder import json_to_span
from .span_json_encoder import span_to_json
from .trace_evaluations import TraceEvaluations

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


TraceEvaluationOrDataFrame = Union[TraceEvaluations, DataFrame]

# Overload support for a single TraceEvaluation or DataFrame or a list of them
TraceEvaluationsParam = Union[TraceEvaluationOrDataFrame, List[TraceEvaluationOrDataFrame]]


def normalize_dataframe(dataframe: DataFrame) -> "DataFrame":
    """Makes the dataframe have appropriate data types"""

    # Convert the start and end times to datetime
    dataframe["start_time"] = normalize_timestamps(dataframe["start_time"])
    dataframe["end_time"] = normalize_timestamps(dataframe["end_time"])
    return dataframe


def parse_evaluations_param(
    evaluations: TraceEvaluationsParam,
) -> Iterator[TraceEvaluations]:
    """constructs a list of evaluations into a single iterator of evaluations"""
    if isinstance(evaluations, TraceEvaluations):
        yield evaluations
    elif isinstance(evaluations, DataFrame):
        yield TraceEvaluations(evaluations)
    else:
        for evaluation in evaluations:
            yield from parse_evaluations_param(evaluation)


class TraceDataset:
    """
    A TraceDataset is a wrapper around a dataframe which is a flattened representation
    of Spans. The collection of spans trace the LLM application's execution.
    """

    name: str
    dataframe: pd.DataFrame
    evaluations: List[TraceEvaluations] = []
    _data_file_name: str = "data.parquet"

    def __init__(
        self,
        dataframe: DataFrame,
        name: Optional[str] = None,
        evaluations: Optional[TraceEvaluationsParam] = None,
    ):
        """
        Constructs a TraceDataset from a dataframe of spans. Optionally takes in evaluations
        for the spans in the dataset.
        Parameters
        __________
        dataframe: pandas.DataFrame
            the pandas dataframe containing the tracing data. Each row represents a span.
        evaluations: Optional[raceEvaluationsParam]
            a single or list of evaluations for the spans in the dataset
        """
        # Validate the the dataframe has required fields
        if missing_columns := set(REQUIRED_COLUMNS) - set(dataframe.columns):
            raise ValueError(
                f"The dataframe is missing some required columns: {', '.join(missing_columns)}"
            )
        self.dataframe = normalize_dataframe(dataframe)
        self.name = name or f"{GENERATED_DATASET_NAME_PREFIX}{str(uuid.uuid4())}"
        self.evaluations = []
        if evaluations is not None:
            parsed_evaluations = list(parse_evaluations_param(evaluations))
            # Append the evaluations to the list of evaluations
            self.evaluations.extend(parsed_evaluations)

    @classmethod
    def from_spans(cls, spans: List[Span]) -> "TraceDataset":
        """Creates a TraceDataset from a list of spans.

        Args:
            spans (List[Span]): A list of spans.

        Returns:
            TraceDataset: A TraceDataset containing the spans.
        """
        return cls(
            pd.json_normalize(
                (json.loads(span_to_json(span)) for span in spans),  # type: ignore
                max_level=1,
            )
        )

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
            end_time: Optional[datetime] = cast(datetime, row.get("end_time"))
            if end_time is pd.NaT:
                end_time = None
            yield json_to_span(
                {
                    "name": row["name"],
                    "context": context,
                    "span_kind": row["span_kind"],
                    "parent_id": row.get("parent_id"),
                    "start_time": cast(datetime, row["start_time"]).isoformat(),
                    "end_time": end_time.isoformat() if end_time else None,
                    "status_code": row["status_code"],
                    "status_message": row.get("status_message") or "",
                    "attributes": attributes,
                    "events": row.get("events") or [],
                    "conversation": row.get("conversation"),
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

    def add_evaluations(self, evaluations: TraceEvaluationsParam) -> None:
        """adds evaluations to the dataset"""
        parsed_evaluations = list(parse_evaluations_param(evaluations))
        # Append the evaluations to the list of evaluations
        self.evaluations.extend(parsed_evaluations)

    def to_spans_dataframe(self, include_evaluations: bool = True) -> DataFrame:
        """converts the dataset to a dataframe of spans"""
        if include_evaluations is False:
            return self.dataframe

        # Construct a new dataframe with the evaluations
        df = self.dataframe.copy()
        print(df.columns)
        for evaluation in self.evaluations:
            df = pd.merge(
                df, evaluation.dataframe, left_on="context.span_id", right_on="span_id", how="left"
            )
        # drop the span_id column
        df = df.drop(columns=["span_id"])
        return df
