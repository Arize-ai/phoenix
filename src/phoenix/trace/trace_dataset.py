import json
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Iterator, List, Optional, Tuple, Union, cast
from uuid import UUID, uuid4
from warnings import warn

import numpy as np
import pandas as pd
from openinference.semconv.trace import (
    DocumentAttributes,
    RerankerAttributes,
    SpanAttributes,
)
from pandas import DataFrame, read_parquet
from pyarrow import Schema, Table, parquet

from phoenix.config import GENERATED_INFERENCES_NAME_PREFIX, INFERENCES_DIR, TRACE_DATASETS_DIR
from phoenix.datetime_utils import normalize_timestamps
from phoenix.trace.attributes import unflatten
from phoenix.trace.errors import InvalidParquetMetadataError
from phoenix.trace.schemas import ATTRIBUTE_PREFIX, CONTEXT_PREFIX, Span
from phoenix.trace.span_evaluations import Evaluations, SpanEvaluations
from phoenix.trace.span_json_decoder import json_to_span
from phoenix.trace.span_json_encoder import span_to_json

DOCUMENT_METADATA = DocumentAttributes.DOCUMENT_METADATA
RERANKER_INPUT_DOCUMENTS = RerankerAttributes.RERANKER_INPUT_DOCUMENTS
RERANKER_OUTPUT_DOCUMENTS = RerankerAttributes.RERANKER_OUTPUT_DOCUMENTS
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS

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

TRACE_DATASET_PARQUET_FILE_NAME = "trace_dataset-{id}.parquet"


def normalize_dataframe(dataframe: DataFrame) -> "DataFrame":
    """Makes the dataframe have appropriate data types"""

    # Convert the start and end times to datetime
    dataframe["start_time"] = normalize_timestamps(dataframe["start_time"])
    dataframe["end_time"] = normalize_timestamps(dataframe["end_time"])
    dataframe = dataframe.replace({np.nan: None})
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

    Typical usage example::

        from phoenix.trace.utils import json_lines_to_df

        with open("trace.jsonl", "r") as f:
            trace_ds = TraceDataset(json_lines_to_df(f.readlines()))
        px.launch_app(trace=trace_ds)
    """

    name: str
    """
    A human readable name for the dataset.
    """
    dataframe: pd.DataFrame
    evaluations: List[Evaluations] = []
    _id: UUID
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

        Args:
            dataframe (pandas.DataFrame): The pandas dataframe containing the
                tracing data. Each row of which is a flattened representation
                of a span.
            name (str): The name used to identify the dataset in the application.
                If not provided, a random name will be generated.
            evaluations (Optional[Iterable[SpanEvaluations]]): An optional list of
                evaluations for the spans in the dataset. If provided, the evaluations
                can be materialized into a unified dataframe as annotations.
        """
        # Validate the the dataframe has required fields
        if missing_columns := set(REQUIRED_COLUMNS) - set(dataframe.columns):
            raise ValueError(
                f"The dataframe is missing some required columns: {', '.join(missing_columns)}"
            )
        self._id = uuid4()
        self.dataframe = normalize_dataframe(dataframe)
        # TODO: This is not used in any meaningful way. Should remove
        self.name = name or f"{GENERATED_INFERENCES_NAME_PREFIX}{str(self._id)}"
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
            attributes = unflatten(
                row.loc[is_attribute]
                .rename(
                    {key: key[len(ATTRIBUTE_PREFIX) :] for key in attribute_keys},
                )
                .dropna()
                .items()
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
        directory = INFERENCES_DIR / name
        df = read_parquet(directory / cls._data_file_name)
        return cls(df, name)

    def to_disc(self) -> None:
        """writes the data to disc"""
        directory = INFERENCES_DIR / self.name
        directory.mkdir(parents=True, exist_ok=True)
        get_serializable_spans_dataframe(self.dataframe).to_parquet(
            directory / self._data_file_name,
            allow_truncated_timestamps=True,
            coerce_timestamps="ms",
        )

    def save(self, directory: Optional[Union[str, Path]] = None) -> UUID:
        """
        Writes the trace dataset to disk. If any evaluations have been appended
        to the dataset, those evaluations will be saved to separate files within
        the same directory.

        Args:
            directory (Optional[Union[str, Path]], optional): An optional path
                to a directory where the data will be written. If not provided, the
                data will be written to a default location.

        Returns:
            UUID: The id of the trace dataset, which can be used as key to load
                the dataset from disk using `load`.
        """
        directory = Path(directory or TRACE_DATASETS_DIR)
        for evals in self.evaluations:
            evals.save(directory)
        path = directory / TRACE_DATASET_PARQUET_FILE_NAME.format(id=self._id)
        dataframe = get_serializable_spans_dataframe(self.dataframe)
        dataframe.to_parquet(
            path,
            allow_truncated_timestamps=True,
            coerce_timestamps="ms",
        )
        table = Table.from_pandas(self.dataframe)
        table = table.replace_schema_metadata(
            {
                **(table.schema.metadata or {}),
                # explicitly encode keys and values, which are automatically encoded regardless
                b"arize": json.dumps(
                    {
                        "dataset_id": str(self._id),
                        "dataset_name": self.name,
                        "eval_ids": [str(evals.id) for evals in self.evaluations],
                    }
                ).encode("utf-8"),
            }
        )
        parquet.write_table(table, path)
        print(f"💾 Trace dataset saved to under ID: {self._id}")
        print(f"📂 Trace dataset path: {path}")
        return self._id

    @classmethod
    def load(
        cls, id: Union[str, UUID], directory: Optional[Union[str, Path]] = None
    ) -> "TraceDataset":
        """
        Reads in a trace dataset from disk. Any associated evaluations will
        automatically be read from disk and attached to the trace dataset.

        Args:
            id (Union[str, UUID]): The ID of the trace dataset to be loaded.

            directory (Optional[Union[str, Path]], optional): The path to the
                directory containing the persisted trace dataset parquet file. If
                not provided, the parquet file will be loaded from the same default
                location used by `save`.

        Returns:
            TraceDataset: The loaded trace dataset.
        """
        if not isinstance(id, UUID):
            id = UUID(id)
        path = Path(directory or TRACE_DATASETS_DIR) / TRACE_DATASET_PARQUET_FILE_NAME.format(id=id)
        schema = parquet.read_schema(path)
        dataset_id, dataset_name, eval_ids = _parse_schema_metadata(schema)
        if id != dataset_id:
            raise InvalidParquetMetadataError(
                f"The input id {id} does not match the id {dataset_id} in the parquet metadata. "
                "Ensure that you have not renamed the parquet file."
            )
        evaluations = []
        for eval_id in eval_ids:
            try:
                evaluations.append(Evaluations.load(eval_id, path.parent))
            except Exception:
                warn(f'Failed to load evaluations with id: "{eval_id}"')
        table = parquet.read_table(path)
        dataframe = table.to_pandas()
        ds = cls(dataframe=dataframe, name=dataset_name, evaluations=evaluations)
        ds._id = dataset_id
        return ds

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


def _parse_schema_metadata(schema: Schema) -> Tuple[UUID, str, List[UUID]]:
    """
    Returns parsed metadata from a parquet schema or raises an exception if the
    metadata is invalid.
    """
    try:
        metadata = schema.metadata
        arize_metadata = json.loads(metadata[b"arize"])
        dataset_id = UUID(arize_metadata["dataset_id"])
        if not isinstance(dataset_name := arize_metadata["dataset_name"], str):
            raise ValueError("Arize metadata must contain a dataset_name key with string value")
        eval_ids = [UUID(eval_id) for eval_id in arize_metadata["eval_ids"]]
        return dataset_id, dataset_name, eval_ids
    except Exception as err:
        raise InvalidParquetMetadataError("Unable to parse parquet metadata") from err
