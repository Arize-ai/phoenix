import logging
import os
import sys
import uuid
from copy import deepcopy
from dataclasses import fields, replace
from datetime import datetime, timedelta
from enum import Enum
from functools import cached_property
from typing import Any, Dict, List, Optional, Set, Tuple, Union, cast

from pandas import DataFrame, Series, Timestamp, read_parquet, to_datetime
from pandas.api.types import is_numeric_dtype

from phoenix.config import dataset_dir

from . import errors as err
from .schema import (
    MULTI_COLUMN_SCHEMA_FIELD_NAMES,
    SINGLE_COLUMN_SCHEMA_FIELD_NAMES,
    EmbeddingColumnNames,
    EmbeddingFeatures,
    Schema,
    SchemaFieldName,
    SchemaFieldValue,
)
from .validation import validate_dataset_inputs

logger = logging.getLogger(__name__)
if hasattr(sys, "ps1"):
    # for python interactive mode
    log_handler = logging.StreamHandler(sys.stdout)
    log_handler.setLevel(logging.INFO)
    logger.addHandler(log_handler)
    logger.setLevel(logging.INFO)


class Dataset:
    """
    A dataset to use for analysis using phoenix.
    Used to construct a phoenix session via px.launch_app

    Parameters
    ----------
    dataframe : pandas.DataFrame
        The pandas dataframe containing the data to analyze
    schema : phoenix.Schema
        the schema of the dataset. Maps dataframe columns to the appropriate
        model inference dimensions (features, predictions, actuals).
    name : str, optional
        The name of the dataset. If not provided, a random name will be generated.
        Is helpful for identifying the dataset in the application.

    Returns
    -------
    dataset : Dataset
        The dataset object that can be used in a phoenix session

    Examples
    --------
    >>> primary_dataset = px.Dataset(dataframe=production_dataframe, schema=schema, name="primary")
    """

    _data_file_name: str = "data.parquet"
    _schema_file_name: str = "schema.json"
    _is_persisted: bool = False

    def __init__(
        self,
        dataframe: DataFrame,
        schema: Schema,
        name: Optional[str] = None,
        persist_to_disc: bool = True,
    ):
        errors = validate_dataset_inputs(
            dataframe=dataframe,
            schema=schema,
        )
        if errors:
            for e in errors:
                logger.error(e)
            raise err.DatasetError(errors)
        dataframe, schema = _parse_dataframe_and_schema(dataframe, schema)
        dataframe = _sort_dataframe_rows_by_timestamp(dataframe, schema)
        self.__dataframe: DataFrame = dataframe
        self.__schema: Schema = schema
        self.__name: str = name if name is not None else f"""dataset_{str(uuid.uuid4())}"""
        self.__directory: str = os.path.join(dataset_dir, self.name)

        # Sync the dataset to disc so that the server can pick up the data
        if persist_to_disc:
            self.to_disc()
        else:
            # Assume that the dataset is already persisted to disc
            self._is_persisted: bool = True

        self.to_disc()
        logger.info(f"""Dataset: {self.__name} initialized""")

    @cached_property
    def start_time(self) -> datetime:
        """Returns the datetime of the earliest inference in the dataset"""
        timestamp_col_name: str = cast(str, self.schema.timestamp_column_name)
        start_datetime: datetime = self.__dataframe[timestamp_col_name].min()
        return start_datetime

    @cached_property
    def end_time(self) -> datetime:
        """
        Returns the datetime of the latest inference in the dataset.
        end_datetime equals max(timestamp) + 1 microsecond, so that it can be
        used as part of a right-open interval.
        """
        timestamp_col_name: str = cast(str, self.schema.timestamp_column_name)
        end_datetime: datetime = self.__dataframe[timestamp_col_name].max() + timedelta(
            microseconds=1,
        )  # adding a microsecond, so it can be used as part of a right open interval
        return end_datetime

    @property
    def dataframe(self) -> DataFrame:
        return self.__dataframe

    @property
    def schema(self) -> "Schema":
        return self.__schema

    @property
    def name(self) -> str:
        return self.__name

    @property
    def is_persisted(self) -> bool:
        return self._is_persisted

    @property
    def directory(self) -> str:
        """The directory under which the dataset metadata is stored"""
        return self.__directory

    def head(self, num_rows: Optional[int] = 5) -> DataFrame:
        num_rows = 5 if num_rows is None else num_rows
        return self.dataframe.head(num_rows)

    def get_column(self, col_name: str) -> "Union[Series[int], Series[float], Series[str]]":
        return self.dataframe[col_name]

    def sample(self, num: int) -> "Dataset":
        sampled_dataframe = self.dataframe.sample(n=num, ignore_index=True)
        return Dataset(sampled_dataframe, self.schema, f"""{self.name}_sample_{num}""")

    def get_prediction_id_column(
        self,
    ) -> "Series[str]":
        if self.schema.prediction_id_column_name is None:
            raise err.SchemaError(err.MissingField("prediction_id_column_name"))
        return self.dataframe[self.schema.prediction_id_column_name]

    def get_prediction_label_column(
        self,
    ) -> "Series[str]":
        if self.schema.prediction_label_column_name is None:
            raise err.SchemaError(err.MissingField("prediction_label_column_name"))
        return self.dataframe[self.schema.prediction_label_column_name]

    def get_prediction_score_column(
        self,
    ) -> "Series[float]":
        if self.schema.prediction_score_column_name is None:
            raise err.SchemaError(err.MissingField("prediction_score_column_name"))
        return self.dataframe[self.schema.prediction_score_column_name]

    def get_actual_label_column(self) -> "Series[str]":
        if self.schema.actual_label_column_name is None:
            raise err.SchemaError(err.MissingField("actual_label_column_name"))
        return self.dataframe[self.schema.actual_label_column_name]

    def get_actual_score_column(self) -> "Union[Series[float]]":
        if self.schema.actual_score_column_name is None:
            raise err.SchemaError(err.MissingField("actual_score_column_name"))
        return self.dataframe[self.schema.actual_score_column_name]

    def _get_embedding_feature_column_names(
        self, embedding_feature_name: str
    ) -> EmbeddingColumnNames:
        if self.schema.embedding_feature_column_names is None:
            raise err.SchemaError(err.MissingField("embedding_feature_column_names"))
        embedding_feature_column_names = self.schema.embedding_feature_column_names
        if (
            embedding_feature_name not in embedding_feature_column_names
            or embedding_feature_column_names[embedding_feature_name] is None
        ):
            raise err.SchemaError(err.MissingEmbeddingFeatureColumnNames(embedding_feature_name))
        return embedding_feature_column_names[embedding_feature_name]

    def get_timestamp_column(self) -> "Series[Any]":
        timestamp_column_name = self.schema.timestamp_column_name
        if timestamp_column_name is None:
            raise err.SchemaError(err.MissingTimestampColumnName())
        return self.dataframe[timestamp_column_name]

    # TODO(mikeldking): add strong vector type
    def get_embedding_vector_column(self, embedding_feature_name: str) -> "Series[Any]":
        column_names = self._get_embedding_feature_column_names(embedding_feature_name)
        if column_names.vector_column_name is None:
            raise err.SchemaError(
                err.MissingEmbeddingFeatureVectorColumnName(embedding_feature_name)
            )
        vector_column = self.dataframe[column_names.vector_column_name]
        return vector_column

    def get_embedding_raw_data_column(self, embedding_feature_name: str) -> "Optional[Series[str]]":
        column_names = self._get_embedding_feature_column_names(embedding_feature_name)
        if column_names.raw_data_column_name is not None:
            return self.dataframe[column_names.raw_data_column_name]
        return None

    def get_embedding_link_to_data_column(
        self, embedding_feature_name: str
    ) -> "Optional[Series[str]]":
        column_names = self._get_embedding_feature_column_names(embedding_feature_name)
        if column_names.link_to_data_column_name is not None:
            return self.dataframe[column_names.link_to_data_column_name]

        return None

    @classmethod
    def from_dataframe(
        cls, dataframe: DataFrame, schema: Schema, name: Optional[str] = None
    ) -> "Dataset":
        return cls(dataframe, schema, name)

    @classmethod
    def from_name(cls, name: str) -> "Dataset":
        """Retrieves a dataset by name from the file system"""
        directory = os.path.join(dataset_dir, name)
        df = read_parquet(os.path.join(directory, cls._data_file_name))
        with open(os.path.join(directory, cls._schema_file_name)) as schema_file:
            schema_json = schema_file.read()
        schema = Schema.from_json(schema_json)
        return cls(df, schema, name, persist_to_disc=False)

    def to_disc(self) -> None:
        """writes the data and schema to disc"""

        if self._is_persisted:
            logger.info("Dataset already persisted")
            return

        directory = self.directory
        if not os.path.isdir(directory):
            os.makedirs(directory)

        self.dataframe.to_parquet(
            os.path.join(directory, self._data_file_name),
            allow_truncated_timestamps=True,
            coerce_timestamps="ms",
        )

        schema_json_data = self.schema.to_json()
        with open(os.path.join(directory, self._schema_file_name), "w+") as schema_file:
            schema_file.write(schema_json_data)

        # set the persisted flag so that we don't have to perform this operation again
        self._is_persisted = True
        logger.info(f"Dataset info written to '{directory}'")


def _parse_dataframe_and_schema(dataframe: DataFrame, schema: Schema) -> Tuple[DataFrame, Schema]:
    """
    Parses a dataframe according to a schema, infers feature columns names when
    they are not explicitly provided, and removes excluded column names from
    both dataframe and schema.

    Removes column names in `schema.excludes` from the input dataframe and
    schema. To remove an embedding feature and all associated columns, add the
    name of the embedding feature to `schema.excludes` rather than the
    associated column names. If `schema.feature_column_names` is `None`,
    automatically discovers features by adding all column names present in the
    dataframe but not included in any other schema fields.
    """

    unseen_excluded_column_names: Set[str] = (
        set(schema.excludes) if schema.excludes is not None else set()
    )
    unseen_column_names: Set[str] = set(dataframe.columns.to_list())
    column_name_to_include: Dict[str, bool] = {}
    schema_patch: Dict[SchemaFieldName, SchemaFieldValue] = {}

    for schema_field_name in SINGLE_COLUMN_SCHEMA_FIELD_NAMES:
        _check_single_column_schema_field_for_excluded_columns(
            schema,
            schema_field_name,
            unseen_excluded_column_names,
            schema_patch,
            column_name_to_include,
            unseen_column_names,
        )

    for schema_field_name in MULTI_COLUMN_SCHEMA_FIELD_NAMES:
        _check_multi_column_schema_field_for_excluded_columns(
            schema,
            schema_field_name,
            unseen_excluded_column_names,
            schema_patch,
            column_name_to_include,
            unseen_column_names,
        )

    if schema.embedding_feature_column_names:
        _check_embedding_features_schema_field_for_excluded_columns(
            schema.embedding_feature_column_names,
            unseen_excluded_column_names,
            schema_patch,
            column_name_to_include,
            unseen_column_names,
        )

    if not schema.feature_column_names and unseen_column_names:
        _discover_feature_columns(
            dataframe,
            unseen_excluded_column_names,
            schema_patch,
            column_name_to_include,
            unseen_column_names,
        )

    if unseen_excluded_column_names:
        logger.warning(
            "The following columns and embedding features were excluded in the schema but were "
            "not found in the dataframe: {}".format(", ".join(unseen_excluded_column_names))
        )

    parsed_dataframe, parsed_schema = _create_and_normalize_dataframe_and_schema(
        dataframe, schema, schema_patch, column_name_to_include
    )

    return parsed_dataframe, parsed_schema


def _check_single_column_schema_field_for_excluded_columns(
    schema: Schema,
    schema_field_name: str,
    unseen_excluded_column_names: Set[str],
    schema_patch: Dict[SchemaFieldName, SchemaFieldValue],
    column_name_to_include: Dict[str, bool],
    unseen_column_names: Set[str],
) -> None:
    """
    Checks single-column schema fields for excluded column names.
    """
    column_name: str = getattr(schema, schema_field_name)
    include_column: bool = column_name not in unseen_excluded_column_names
    column_name_to_include[column_name] = include_column
    if not include_column:
        schema_patch[schema_field_name] = None
        unseen_excluded_column_names.discard(column_name)
        logger.debug(f"excluded {schema_field_name}: {column_name}")
    unseen_column_names.discard(column_name)


def _check_multi_column_schema_field_for_excluded_columns(
    schema: Schema,
    schema_field_name: str,
    unseen_excluded_column_names: Set[str],
    schema_patch: Dict[SchemaFieldName, SchemaFieldValue],
    column_name_to_include: Dict[str, bool],
    unseen_column_names: Set[str],
) -> None:
    """
    Checks multi-column schema fields for excluded columns names.
    """
    column_names: Optional[List[str]] = getattr(schema, schema_field_name)
    if column_names:
        included_column_names: List[str] = []
        excluded_column_names: List[str] = []
        for column_name in column_names:
            is_included_column = column_name not in unseen_excluded_column_names
            column_name_to_include[column_name] = is_included_column
            if is_included_column:
                included_column_names.append(column_name)
            else:
                excluded_column_names.append(column_name)
                unseen_excluded_column_names.discard(column_name)
                logger.debug(f"excluded {schema_field_name}: {column_name}")
            unseen_column_names.discard(column_name)
        schema_patch[schema_field_name] = included_column_names if included_column_names else None


def _check_embedding_features_schema_field_for_excluded_columns(
    embedding_features: EmbeddingFeatures,
    unseen_excluded_column_names: Set[str],
    schema_patch: Dict[SchemaFieldName, SchemaFieldValue],
    column_name_to_include: Dict[str, bool],
    unseen_column_names: Set[str],
) -> None:
    """
    Check embedding features for excluded column names.
    """
    included_embedding_features: EmbeddingFeatures = {}
    for (
        embedding_feature_name,
        embedding_column_name_mapping,
    ) in embedding_features.items():
        include_embedding_feature = embedding_feature_name not in unseen_excluded_column_names
        if include_embedding_feature:
            included_embedding_features[embedding_feature_name] = deepcopy(
                embedding_column_name_mapping
            )
        else:
            unseen_excluded_column_names.discard(embedding_feature_name)

        for embedding_field in fields(embedding_column_name_mapping):
            column_name: Optional[str] = getattr(
                embedding_column_name_mapping, embedding_field.name
            )
            if column_name is not None:
                column_name_to_include[column_name] = include_embedding_feature
                if (
                    column_name != embedding_feature_name
                    and column_name in unseen_excluded_column_names
                ):
                    logger.warning(
                        f"Excluding embedding feature columns such as "
                        f'"{column_name}" has no effect; instead exclude the '
                        f'corresponding embedding feature name "{embedding_feature_name}".'
                    )
                    unseen_excluded_column_names.discard(column_name)
                unseen_column_names.discard(column_name)
    schema_patch["embedding_feature_column_names"] = (
        included_embedding_features if included_embedding_features else None
    )


def _discover_feature_columns(
    dataframe: DataFrame,
    unseen_excluded_column_names: Set[str],
    schema_patch: Dict[SchemaFieldName, SchemaFieldValue],
    column_name_to_include: Dict[str, bool],
    unseen_column_names: Set[str],
) -> None:
    """
    Adds unseen and unexcluded columns as features.
    """
    discovered_feature_column_names = []
    for column_name in unseen_column_names:
        if column_name not in unseen_excluded_column_names:
            discovered_feature_column_names.append(column_name)
            column_name_to_include[column_name] = True
        else:
            unseen_excluded_column_names.discard(column_name)
            logger.debug(f"excluded feature: {column_name}")
    original_column_positions: List[int] = dataframe.columns.get_indexer(
        discovered_feature_column_names
    )  # type: ignore
    feature_column_name_to_position: Dict[str, int] = dict(
        zip(discovered_feature_column_names, original_column_positions)
    )
    discovered_feature_column_names.sort(key=lambda col: feature_column_name_to_position[col])
    schema_patch["feature_column_names"] = discovered_feature_column_names
    logger.debug(
        "Discovered feature column names: {}".format(", ".join(discovered_feature_column_names))
    )


def _create_and_normalize_dataframe_and_schema(
    dataframe: DataFrame,
    schema: Schema,
    schema_patch: Dict[SchemaFieldName, SchemaFieldValue],
    column_name_to_include: Dict[str, bool],
) -> Tuple[DataFrame, Schema]:
    """
    Creates new dataframe and schema objects to reflect excluded column names
    and discovered features. This also normalizes dataframe columns to ensure a
    standard set of columns (i.e. timestamp and prediction_id) and datatypes for
    those columns.
    """
    included_column_names: List[str] = []
    for column_name in dataframe.columns:
        if column_name_to_include.get(str(column_name), False):
            included_column_names.append(str(column_name))
    parsed_dataframe = dataframe[included_column_names].copy()
    parsed_schema = replace(schema, excludes=None, **schema_patch)

    ts_col_name = parsed_schema.timestamp_column_name
    if ts_col_name is None:
        now = Timestamp.utcnow()
        parsed_schema = replace(parsed_schema, timestamp_column_name="timestamp")
        parsed_dataframe["timestamp"] = now
    elif is_numeric_dtype(dataframe.dtypes[ts_col_name]):
        parsed_dataframe[ts_col_name] = parsed_dataframe[ts_col_name].apply(
            lambda x: to_datetime(x, unit="s", utc=True)
        )

    pred_col_name = parsed_schema.prediction_id_column_name
    if pred_col_name is None:
        parsed_schema = replace(parsed_schema, prediction_id_column_name="prediction_id")
        parsed_dataframe["prediction_id"] = parsed_dataframe.apply(lambda _: str(uuid.uuid4()))
    elif is_numeric_dtype(parsed_dataframe.dtypes[pred_col_name]):
        parsed_dataframe[pred_col_name] = parsed_dataframe[pred_col_name].astype(str)

    return parsed_dataframe, parsed_schema


class DatasetType(Enum):
    PRIMARY = 0
    REFERENCE = 1


def _sort_dataframe_rows_by_timestamp(dataframe: DataFrame, schema: Schema) -> DataFrame:
    """
    Sorts dataframe rows by timestamp.
    """
    timestamp_column_name = schema.timestamp_column_name
    if timestamp_column_name is None:
        raise ValueError("Schema must specify a timestamp column name.")
    dataframe.set_index(timestamp_column_name, drop=False, inplace=True)
    dataframe.sort_index(inplace=True)
    return dataframe
