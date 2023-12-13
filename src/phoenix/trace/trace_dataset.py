import json
import uuid
from datetime import datetime
from typing import Any, Iterable, Iterator, List, Optional, cast

import pandas as pd
from pandas import DataFrame, read_parquet

from phoenix.datetime_utils import normalize_timestamps

from ..config import DATASET_DIR, GENERATED_DATASET_NAME_PREFIX
from .schemas import ATTRIBUTE_PREFIX, CONTEXT_PREFIX, Span
from .semantic_conventions import (
    DOCUMENT_METADATA,
    RERANKER_INPUT_DOCUMENTS,
    RERANKER_OUTPUT_DOCUMENTS,
    RETRIEVAL_DOCUMENTS,
)
from .span_evaluations import Evaluations, SpanEvaluations
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

RETRIEVAL_DOCUMENTS_COLUMN_NAME = f"{ATTRIBUTE_PREFIX}{RETRIEVAL_DOCUMENTS}"
RERANKER_INPUT_DOCUMENTS_COLUMN_NAME = f"{ATTRIBUTE_PREFIX}{RERANKER_INPUT_DOCUMENTS}"
RERANKER_OUTPUT_DOCUMENTS_COLUMN_NAME = f"{ATTRIBUTE_PREFIX}{RERANKER_OUTPUT_DOCUMENTS}"

DOCUMENT_COLUMNS = [
    RETRIEVAL_DOCUMENTS_COLUMN_NAME,
    RERANKER_INPUT_DOCUMENTS_COLUMN_NAME,
    RERANKER_OUTPUT_DOCUMENTS_COLUMN_NAME,
]


def normalize_dataframe(dataframe: DataFrame) -> "DataFrame":
    """Makes the dataframe have appropriate data types"""

    # Convert the start and end times to datetime
    dataframe["start_time"] = normalize_timestamps(dataframe["start_time"])
    dataframe["end_time"] = normalize_timestamps(dataframe["end_time"])
    return dataframe


def _delete_empty_document_metadata(documents: Any) -> Any:
    """
    Removes ambiguous and empty dicts from the documents list so the is object
    serializable to parquet
    """
    # If the documents is a list, iterate over them, check that the metadata is
    # a dict, see if it is empty, and if it's empty, delete the metadata
    if isinstance(documents, list):
        # Make a shallow copy of the keys
        documents = list(map(dict, documents))
        for document in documents:
            metadata = document.get(DOCUMENT_METADATA)
            if isinstance(metadata, dict) and not metadata:
                # Delete the metadata object since empty dicts are not serializable
                del document[DOCUMENT_METADATA]
    return documents


def get_serializable_spans_dataframe(dataframe: DataFrame) -> DataFrame:
    """
    Returns a dataframe that can be serialized to parquet. This means that
    the dataframe must not contain any unserializable objects. This function
    will delete any unserializable objects from the dataframe.
    """
    dataframe = dataframe.copy(deep=False)  # copy, don't mutate
    # Check if the dataframe has any document columns
    is_documents_column = dataframe.columns.isin(DOCUMENT_COLUMNS)
    for name, column in dataframe.loc[:, is_documents_column].items():  # type: ignore
        dataframe[name] = column.apply(_delete_empty_document_metadata)
    return dataframe


class TraceDataset:
    """
    A TraceDataset is a wrapper around a dataframe which is a flattened representation
    of Spans. The collection of spans trace the LLM application's execution.
    """

    name: str
    dataframe: pd.DataFrame
    evaluations: List[Evaluations] = []
    _data_file_name: str = "data.parquet"

    def __init__(
        self,
        dataframe: DataFrame,
        name: Optional[str] = None,
        evaluations: Iterable[Evaluations] = (),
    ):
        """
        Constructs a TraceDataset from a dataframe of spans. Optionally takes in
        evaluations for the spans in the dataset.

        Parameters
        __________
        dataframe: pandas.DataFrame
            the pandas dataframe containing the tracing data. Each row
            represents a span.
        evaluations: Optional[Iterable[SpanEvaluations]]
            an optional list of evaluations for the spans in the dataset. If
            provided, the evaluations can be materialized into a unified
            dataframe as annotations.
        """
        # Validate the the dataframe has required fields
        if missing_columns := set(REQUIRED_COLUMNS) - set(dataframe.columns):
            raise ValueError(
                f"The dataframe is missing some required columns: {', '.join(missing_columns)}"
            )
        self.dataframe = normalize_dataframe(dataframe)
        self.name = name or f"{GENERATED_DATASET_NAME_PREFIX}{str(uuid.uuid4())}"
        self.evaluations = list(evaluations)

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
        get_serializable_spans_dataframe(self.dataframe).to_parquet(
            directory / self._data_file_name,
            allow_truncated_timestamps=True,
            coerce_timestamps="ms",
        )

    def append_evaluations(self, evaluations: Evaluations) -> None:
        """adds an evaluation to the traces"""
        # Append the evaluations to the list of evaluations
        self.evaluations.append(evaluations)

    def get_evals_dataframe(self) -> DataFrame:
        """
        Creates a flat dataframe of all the evaluations for the dataset.
        """
        return pd.concat(
            [
                evals.get_dataframe(prefix_columns_with_name=True)
                for evals in self.evaluations
                if isinstance(evals, SpanEvaluations)
            ],
            axis=1,
        )

    def get_spans_dataframe(self, include_evaluations: bool = True) -> DataFrame:
        """
        converts the dataset to a dataframe of spans. If evaluations are included,
        the evaluations are merged into the dataframe.

        Parameters
        __________
        include_evaluations: bool
            if True, the evaluations are merged into the dataframe
        """
        if not include_evaluations or not self.evaluations:
            return self.dataframe.copy()
        evals_df = self.get_evals_dataframe()
        # Make sure the index is set to the span_id
        df = self.dataframe.set_index("context.span_id", drop=False)
        return pd.concat([df, evals_df], axis=1)
