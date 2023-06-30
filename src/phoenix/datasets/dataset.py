import logging
import uuid
from copy import deepcopy
from dataclasses import fields, replace
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import numpy as np
import pandas as pd
import pytz
from pandas import DataFrame, Series, Timestamp, read_parquet, to_datetime
from pandas.api.types import (
    is_datetime64_any_dtype,
    is_datetime64tz_dtype,
    is_numeric_dtype,
    is_object_dtype,
)
from typing_extensions import TypeAlias

from phoenix.config import DATASET_DIR, GENERATED_DATASET_NAME_PREFIX

from . import errors as err
from .schema import (
    LLM_SCHEMA_FIELD_NAMES,
    MULTI_COLUMN_SCHEMA_FIELD_NAMES,
    SINGLE_COLUMN_SCHEMA_FIELD_NAMES,
    EmbeddingColumnNames,
    EmbeddingFeatures,
    Relationships,
    Schema,
    SchemaFieldName,
    SchemaFieldValue,
)
from .validation import validate_dataset_inputs

logger = logging.getLogger(__name__)

# A schema like object. Not recommended to use this directly
SchemaLike: TypeAlias = Any


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
        schema: Union[Schema, SchemaLike],
        name: Optional[str] = None,
    ):
        # allow for schema like objects
        if not isinstance(schema, Schema):
            schema = _get_schema_from_unknown_schema_param(schema)
        errors = validate_dataset_inputs(
            dataframe=dataframe,
            schema=schema,
        )
        if errors:
            for e in errors:
                logger.error(e)
            raise err.DatasetError(errors)
        dataframe, schema = _parse_dataframe_and_schema(dataframe, schema)
        dataframe, schema = _normalize_timestamps(
            dataframe, schema, default_timestamp=Timestamp.utcnow()
        )
        dataframe = _sort_dataframe_rows_by_timestamp(dataframe, schema)
        self.__dataframe: DataFrame = dataframe
        self.__schema: Schema = schema
        self.__name: str = (
            name if name is not None else f"{GENERATED_DATASET_NAME_PREFIX}{str(uuid.uuid4())}"
        )
        logger.info(f"""Dataset: {self.__name} initialized""")

    def __repr__(self) -> str:
        return f'<Dataset "{self.name}">'

    @property
    def dataframe(self) -> DataFrame:
        return self.__dataframe

    @property
    def schema(self) -> "Schema":
        return self.__schema

    @property
    def name(self) -> str:
        return self.__name

    @classmethod
    def from_name(cls, name: str) -> "Dataset":
        """Retrieves a dataset by name from the file system"""
        directory = DATASET_DIR / name
        df = read_parquet(directory / cls._data_file_name)
        with open(directory / cls._schema_file_name) as schema_file:
            schema_json = schema_file.read()
        schema = Schema.from_json(schema_json)
        return cls(df, schema, name)

    def to_disc(self) -> None:
        """writes the data and schema to disc"""
        directory = DATASET_DIR / self.name
        directory.mkdir(parents=True, exist_ok=True)
        self.dataframe.to_parquet(
            directory / self._data_file_name,
            allow_truncated_timestamps=True,
            coerce_timestamps="ms",
        )
        schema_json_data = self.schema.to_json()
        with open(directory / self._schema_file_name, "w+") as schema_file:
            schema_file.write(schema_json_data)


def _parse_dataframe_and_schema(dataframe: DataFrame, schema: Schema) -> Tuple[DataFrame, Schema]:
    """
    Parses a dataframe according to a schema, infers feature columns names when
    they are not explicitly provided, and removes excluded column names from
    both dataframe and schema.

    Removes column names in `schema.excluded_column_names` from the input dataframe and schema. To
    remove an embedding feature and all associated columns, add the name of the embedding feature to
    `schema.excluded_column_names` rather than the associated column names. If
    `schema.feature_column_names` is `None`, automatically discovers features by adding all column
    names present in the dataframe but not included in any other schema fields.
    """

    unseen_excluded_column_names: Set[str] = (
        set(schema.excluded_column_names) if schema.excluded_column_names is not None else set()
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

    if schema.relationship_column_names:
        _check_relationship_schema_field_for_excluded_columns(
            schema.relationship_column_names,
            unseen_excluded_column_names,
            schema_patch,
            column_name_to_include,
            unseen_column_names,
        )

    for llm_schema_field_name in LLM_SCHEMA_FIELD_NAMES:
        embedding_column_name_mapping = getattr(schema, llm_schema_field_name)
        if embedding_column_name_mapping is not None:
            _check_embedding_column_names_for_excluded_columns(
                embedding_column_name_mapping,
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


def _check_relationship_schema_field_for_excluded_columns(
    relationships: Relationships,
    unseen_excluded_column_names: Set[str],
    schema_patch: Dict[SchemaFieldName, SchemaFieldValue],
    column_name_to_include: Dict[str, bool],
    unseen_column_names: Set[str],
) -> None:
    """
    Check relationships for excluded column names.
    """
    included_relationships: Relationships = {}
    for (
        relationship_name,
        relationship_column_name_mapping,
    ) in relationships.items():
        included_relationships[relationship_name] = deepcopy(relationship_column_name_mapping)
        for relationship_field in fields(relationship_column_name_mapping):
            column_name: Optional[str] = getattr(
                relationship_column_name_mapping, relationship_field.name
            )
            if column_name is not None:
                column_name_to_include[column_name] = True
                if column_name in unseen_excluded_column_names:
                    logger.warning(
                        f"Excluding relationship columns such as {column_name} has no effect"
                    )
                unseen_column_names.discard(column_name)
    schema_patch["relationship_column_names"] = (
        included_relationships if included_relationships else None
    )


def _check_embedding_column_names_for_excluded_columns(
    embedding_column_name_mapping: EmbeddingColumnNames,
    column_name_to_include: Dict[str, bool],
    unseen_column_names: Set[str],
) -> None:
    """
    Check embedding column names for excluded column names.
    """
    for embedding_field in fields(embedding_column_name_mapping):
        column_name: Optional[str] = getattr(embedding_column_name_mapping, embedding_field.name)
        if column_name is not None:
            column_name_to_include[column_name] = True
            unseen_column_names.discard(column_name)


def _discover_feature_columns(
    dataframe: DataFrame,
    unseen_excluded_column_names: Set[str],
    schema_patch: Dict[SchemaFieldName, SchemaFieldValue],
    column_name_to_include: Dict[str, bool],
    unseen_column_names: Set[str],
) -> None:
    """
    Adds unseen and un-excluded columns as features, with the exception of "prediction_id"
    which is reserved
    """
    discovered_feature_column_names = []
    for column_name in unseen_column_names:
        if column_name not in unseen_excluded_column_names and column_name != "prediction_id":
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
    parsed_schema = replace(schema, excluded_column_names=None, **schema_patch)
    pred_id_col_name = parsed_schema.prediction_id_column_name
    if pred_id_col_name is None:
        parsed_schema = replace(parsed_schema, prediction_id_column_name="prediction_id")
        parsed_dataframe["prediction_id"] = _add_prediction_id(len(parsed_dataframe))
    elif is_numeric_dtype(parsed_dataframe.dtypes[pred_id_col_name]):
        parsed_dataframe[pred_id_col_name] = parsed_dataframe[pred_id_col_name].astype(str)
    for embeddings in (
        [parsed_schema.prompt_column_names, parsed_schema.response_column_names]
        + list(parsed_schema.embedding_feature_column_names.values())
        if parsed_schema.embedding_feature_column_names is not None
        else []
    ):
        if embeddings is None:
            continue
        vector_column_name = embeddings.vector_column_name
        if vector_column_name not in parsed_dataframe.columns:
            continue
        parsed_dataframe.loc[:, vector_column_name] = _coerce_vectors_as_arrays_if_necessary(
            parsed_dataframe.loc[:, vector_column_name],
            vector_column_name,
        )
    return parsed_dataframe, parsed_schema


def _coerce_vectors_as_arrays_if_necessary(
    series: "pd.Series[Any]",
    column_name: str,
) -> "pd.Series[Any]":
    not_na = ~series.isna()
    if not_na.sum() == 0:
        return series
    if invalid_types := set(map(type, series.loc[not_na])) - {np.ndarray}:
        logger.warning(
            f"converting items in column `{column_name}` to numpy.ndarray, "
            f"because they have the following "
            f"type{'s' if len(invalid_types) > 1 else ''}: "
            f"{', '.join(map(lambda t: t.__name__, invalid_types))}"
        )
        return series.mask(not_na, series.loc[not_na].apply(np.array))
    return series


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


def _normalize_timestamps(
    dataframe: DataFrame,
    schema: Schema,
    default_timestamp: Timestamp,
) -> Tuple[DataFrame, Schema]:
    """
    Ensures that the dataframe has a timestamp column and the schema has a timestamp field. If the
    input dataframe contains a Unix or datetime timestamp or ISO8601 timestamp strings column, it
    is converted to UTC timestamps. If the input dataframe and schema do not contain timestamps,
    the default timestamp is used.
    """
    timestamp_column: Series[Timestamp]
    if (timestamp_column_name := schema.timestamp_column_name) is None:
        timestamp_column_name = "timestamp"
        schema = replace(schema, timestamp_column_name=timestamp_column_name)
        timestamp_column = (
            Series([default_timestamp] * len(dataframe), index=dataframe.index)
            if len(dataframe)
            else Series([default_timestamp]).iloc[:0].set_axis(dataframe.index, axis=0)
        )
    elif is_numeric_dtype(timestamp_column_dtype := dataframe[timestamp_column_name].dtype):
        timestamp_column = to_datetime(dataframe[timestamp_column_name], unit="s", utc=True)
    elif is_datetime64tz_dtype(timestamp_column_dtype):
        timestamp_column = dataframe[timestamp_column_name].dt.tz_convert(pytz.utc)
    elif is_datetime64_any_dtype(timestamp_column_dtype):
        timestamp_column = dataframe[timestamp_column_name].dt.tz_localize(pytz.utc)
    elif is_object_dtype(timestamp_column_dtype):
        timestamp_column = to_datetime(dataframe[timestamp_column_name], utc=True)
    else:
        raise ValueError(
            "When provided, input timestamp column must have numeric or datetime dtype, "
            f"but found {timestamp_column_dtype} instead."
        )
    dataframe[timestamp_column_name] = timestamp_column
    return dataframe, schema


def _get_schema_from_unknown_schema_param(schemaLike: SchemaLike) -> Schema:
    """
    Compatibility function for converting from arize.utils.types.Schema to phoenix.datasets.Schema
    """
    try:
        from arize.utils.types import (
            EmbeddingColumnNames as ArizeEmbeddingColumnNames,  # fmt: off type: ignore
        )
        from arize.utils.types import Schema as ArizeSchema

        if not isinstance(schemaLike, ArizeSchema):
            raise ValueError("Unknown schema passed to Dataset. Please pass a phoenix Schema")

        embedding_feature_column_names: Dict[str, EmbeddingColumnNames] = {}
        if schemaLike.embedding_feature_column_names is not None:
            for (
                embedding_name,
                arize_embedding_feature_column_names,
            ) in schemaLike.embedding_feature_column_names.items():
                if isinstance(arize_embedding_feature_column_names, ArizeEmbeddingColumnNames):
                    embedding_feature_column_names[embedding_name] = EmbeddingColumnNames(
                        vector_column_name=arize_embedding_feature_column_names.vector_column_name,
                        link_to_data_column_name=arize_embedding_feature_column_names.link_to_data_column_name,
                        raw_data_column_name=arize_embedding_feature_column_names.data_column_name,
                    )
        prompt_column_names: Optional[EmbeddingColumnNames] = None
        if schemaLike.prompt_column_names is not None and isinstance(
            schemaLike.prompt_column_names, ArizeEmbeddingColumnNames
        ):
            prompt_column_names = EmbeddingColumnNames(
                vector_column_name=schemaLike.prompt_column_names.vector_column_name,
                raw_data_column_name=schemaLike.prompt_column_names.data_column_name,
                link_to_data_column_name=schemaLike.prompt_column_names.link_to_data_column_name,
            )
        response_column_names: Optional[EmbeddingColumnNames] = None
        if schemaLike.response_column_names is not None and isinstance(
            schemaLike.response_column_names, ArizeEmbeddingColumnNames
        ):
            response_column_names = EmbeddingColumnNames(
                vector_column_name=schemaLike.response_column_names.vector_column_name,
                raw_data_column_name=schemaLike.response_column_names.data_column_name,
                link_to_data_column_name=schemaLike.response_column_names.link_to_data_column_name,
            )
        return Schema(
            feature_column_names=schemaLike.feature_column_names,
            tag_column_names=schemaLike.tag_column_names,
            prediction_label_column_name=schemaLike.prediction_label_column_name,
            actual_label_column_name=schemaLike.actual_label_column_name,
            prediction_id_column_name=schemaLike.prediction_id_column_name,
            timestamp_column_name=schemaLike.timestamp_column_name,
            embedding_feature_column_names=embedding_feature_column_names,
            prompt_column_names=prompt_column_names,
            response_column_names=response_column_names,
        )
    except Exception:
        raise ValueError(
            """Unsupported Arize Schema. Please pass a phoenix Schema or update
            to the latest version of Arize."""
        )


def _add_prediction_id(num_rows: int) -> List[str]:
    return [str(uuid.uuid4()) for _ in range(num_rows)]
