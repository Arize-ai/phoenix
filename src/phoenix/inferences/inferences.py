import logging
import re
import uuid
from copy import deepcopy
from dataclasses import dataclass, fields, replace
from enum import Enum
from itertools import groupby
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import numpy as np
import pandas as pd
from pandas import DataFrame, Series, Timestamp, read_parquet
from pandas.api.types import (
    is_numeric_dtype,
)
from typing_extensions import TypeAlias

from phoenix.config import GENERATED_INFERENCES_NAME_PREFIX, INFERENCES_DIR
from phoenix.datetime_utils import normalize_timestamps
from phoenix.utilities.deprecation import deprecated

from . import errors as err
from .schema import (
    LLM_SCHEMA_FIELD_NAMES,
    MULTI_COLUMN_SCHEMA_FIELD_NAMES,
    SINGLE_COLUMN_SCHEMA_FIELD_NAMES,
    EmbeddingColumnNames,
    EmbeddingFeatures,
    RetrievalEmbeddingColumnNames,
    Schema,
    SchemaFieldName,
    SchemaFieldValue,
)
from .validation import validate_inferences_inputs

logger = logging.getLogger(__name__)

# A schema like object. Not recommended to use this directly
SchemaLike: TypeAlias = Any


class Inferences:
    """
    A dataset to use for analysis using phoenix.
    Used to construct a phoenix session via px.launch_app.

    Typical usage example::

        primary_inferences = px.Inferences(
            dataframe=production_dataframe, schema=schema, name="primary"
        )

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
    Define inferences ds from a pandas dataframe df and a schema object schema by running::

        ds = px.Inferences(df, schema)

    Alternatively, provide a name for the inferences that will appear in the application::

        ds = px.Inferences(df, schema, name="training")

    ds is then passed as the primary or reference argument to launch_app.
    """

    _data_file_name: str = "data.parquet"
    _schema_file_name: str = "schema.json"
    _is_persisted: bool = False
    _is_empty: bool = False

    def __init__(
        self,
        dataframe: DataFrame,
        schema: Union[Schema, SchemaLike],
        name: Optional[str] = None,
    ):
        # allow for schema like objects
        if not isinstance(schema, Schema):
            schema = _get_schema_from_unknown_schema_param(schema)
        errors = validate_inferences_inputs(
            dataframe=dataframe,
            schema=schema,
        )
        if errors:
            raise err.DatasetError(errors)
        dataframe, schema = _parse_dataframe_and_schema(dataframe, schema)
        dataframe, schema = _normalize_timestamps(
            dataframe, schema, default_timestamp=Timestamp.utcnow()
        )
        dataframe = _sort_dataframe_rows_by_timestamp(dataframe, schema)
        self.__dataframe: DataFrame = dataframe
        self.__schema: Schema = schema
        self.__name: str = (
            name if name is not None else f"{GENERATED_INFERENCES_NAME_PREFIX}{str(uuid.uuid4())}"
        )
        self._is_empty = self.dataframe.empty
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
    def from_name(cls, name: str) -> "Inferences":
        """Retrieves a dataset by name from the file system"""
        directory = INFERENCES_DIR / name
        df = read_parquet(directory / cls._data_file_name)
        with open(directory / cls._schema_file_name) as schema_file:
            schema_json = schema_file.read()
        schema = Schema.from_json(schema_json)
        return cls(df, schema, name)

    def to_disc(self) -> None:
        """writes the data and schema to disc"""
        directory = INFERENCES_DIR / self.name
        directory.mkdir(parents=True, exist_ok=True)
        self.dataframe.to_parquet(
            directory / self._data_file_name,
            allow_truncated_timestamps=True,
            coerce_timestamps="ms",
        )
        schema_json_data = self.schema.to_json()
        with open(directory / self._schema_file_name, "w+") as schema_file:
            schema_file.write(schema_json_data)

    @classmethod
    @deprecated("Inferences.from_open_inference is deprecated and will be removed.")
    def from_open_inference(cls, dataframe: DataFrame) -> "Inferences":
        schema = Schema()
        column_renaming: Dict[str, str] = {}
        for group_name, group in groupby(
            sorted(
                map(_parse_open_inference_column_name, dataframe.columns),
                key=lambda column: column.name,
            ),
            key=lambda column: column.name,
        ):
            open_inference_columns = list(group)
            if group_name == "":
                column_names_by_category = {
                    column.category: column.full_name for column in open_inference_columns
                }
                schema = replace(
                    schema,
                    prediction_id_column_name=column_names_by_category.get(
                        OpenInferenceCategory.id
                    ),
                    timestamp_column_name=column_names_by_category.get(
                        OpenInferenceCategory.timestamp
                    ),
                )
                continue
            column_names_by_specifier = {
                column.specifier: column.full_name for column in open_inference_columns
            }
            if group_name == "response":
                response_vector_column_name = column_names_by_specifier.get(
                    OpenInferenceSpecifier.embedding
                )
                if response_vector_column_name is not None:
                    column_renaming[response_vector_column_name] = "response"
                    schema = replace(
                        schema,
                        response_column_names=EmbeddingColumnNames(
                            vector_column_name=column_renaming[response_vector_column_name],
                            raw_data_column_name=column_names_by_specifier.get(
                                OpenInferenceSpecifier.default
                            ),
                        ),
                    )
                else:
                    response_text_column_name = column_names_by_specifier.get(
                        OpenInferenceSpecifier.default
                    )
                    if response_text_column_name is None:
                        raise ValueError(
                            "invalid OpenInference format: missing text column for response"
                        )
                    column_renaming[response_text_column_name] = "response"
                    schema = replace(
                        schema,
                        response_column_names=column_renaming[response_text_column_name],
                    )
            elif group_name == "prompt":
                prompt_vector_column_name = column_names_by_specifier.get(
                    OpenInferenceSpecifier.embedding
                )
                if prompt_vector_column_name is None:
                    raise ValueError(
                        "invalid OpenInference format: missing embedding vector column for prompt"
                    )
                column_renaming[prompt_vector_column_name] = "prompt"
                schema = replace(
                    schema,
                    prompt_column_names=RetrievalEmbeddingColumnNames(
                        vector_column_name=column_renaming[prompt_vector_column_name],
                        raw_data_column_name=column_names_by_specifier.get(
                            OpenInferenceSpecifier.default
                        ),
                        context_retrieval_ids_column_name=column_names_by_specifier.get(
                            OpenInferenceSpecifier.retrieved_document_ids
                        ),
                        context_retrieval_scores_column_name=column_names_by_specifier.get(
                            OpenInferenceSpecifier.retrieved_document_scores
                        ),
                    ),
                )
            elif OpenInferenceSpecifier.embedding in column_names_by_specifier:
                vector_column_name = column_names_by_specifier[OpenInferenceSpecifier.embedding]
                column_renaming[vector_column_name] = group_name
                embedding_feature_column_names = schema.embedding_feature_column_names or {}
                embedding_feature_column_names.update(
                    {
                        group_name: EmbeddingColumnNames(
                            vector_column_name=column_renaming[vector_column_name],
                            raw_data_column_name=column_names_by_specifier.get(
                                OpenInferenceSpecifier.raw_data
                            ),
                            link_to_data_column_name=column_names_by_specifier.get(
                                OpenInferenceSpecifier.link_to_data
                            ),
                        )
                    }
                )
                schema = replace(
                    schema,
                    embedding_feature_column_names=embedding_feature_column_names,
                )
            elif len(open_inference_columns) == 1:
                open_inference_column = open_inference_columns[0]
                raw_column_name = open_inference_column.full_name
                column_renaming[raw_column_name] = open_inference_column.name
                if open_inference_column.category is OpenInferenceCategory.feature:
                    schema = replace(
                        schema,
                        feature_column_names=(
                            (schema.feature_column_names or []) + [column_renaming[raw_column_name]]
                        ),
                    )
                elif open_inference_column.category is OpenInferenceCategory.tag:
                    schema = replace(
                        schema,
                        tag_column_names=(
                            (schema.tag_column_names or []) + [column_renaming[raw_column_name]]
                        ),
                    )
                elif open_inference_column.category is OpenInferenceCategory.prediction:
                    if open_inference_column.specifier is OpenInferenceSpecifier.score:
                        schema = replace(
                            schema,
                            prediction_score_column_name=column_renaming[raw_column_name],
                        )
                    if open_inference_column.specifier is OpenInferenceSpecifier.label:
                        schema = replace(
                            schema,
                            prediction_label_column_name=column_renaming[raw_column_name],
                        )
                elif open_inference_column.category is OpenInferenceCategory.actual:
                    if open_inference_column.specifier is OpenInferenceSpecifier.score:
                        schema = replace(
                            schema,
                            actual_score_column_name=column_renaming[raw_column_name],
                        )
                    if open_inference_column.specifier is OpenInferenceSpecifier.label:
                        schema = replace(
                            schema,
                            actual_label_column_name=column_renaming[raw_column_name],
                        )
            else:
                raise ValueError(f"invalid OpenInference format: duplicated name `{group_name}`")

        return cls(
            dataframe.rename(
                column_renaming,
                axis=1,
                copy=False,
            ),
            schema,
        )


class OpenInferenceCategory(Enum):
    id = "id"
    timestamp = "timestamp"
    feature = "feature"
    tag = "tag"
    prediction = "prediction"
    actual = "actual"


class OpenInferenceSpecifier(Enum):
    default = ""
    score = "score"
    label = "label"
    embedding = "embedding"
    raw_data = "raw_data"
    link_to_data = "link_to_data"
    retrieved_document_ids = "retrieved_document_ids"
    retrieved_document_scores = "retrieved_document_scores"


@dataclass(frozen=True)
class _OpenInferenceColumnName:
    full_name: str
    category: OpenInferenceCategory
    data_type: str
    specifier: OpenInferenceSpecifier = OpenInferenceSpecifier.default
    name: str = ""


def _parse_open_inference_column_name(column_name: str) -> _OpenInferenceColumnName:
    pattern = (
        r"^:(?P<category>\w+)\.(?P<data_type>\[\w+\]|\w+)(\.(?P<specifier>\w+))?:(?P<name>.*)?$"
    )
    if match := re.match(pattern, column_name):
        extract = match.groupdict(default="")
        return _OpenInferenceColumnName(
            full_name=column_name,
            category=OpenInferenceCategory(extract.get("category", "").lower()),
            data_type=extract.get("data_type", "").lower(),
            specifier=OpenInferenceSpecifier(extract.get("specifier", "").lower()),
            name=extract.get("name", ""),
        )
    raise ValueError(f"Invalid format for column name: {column_name}")


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

    for llm_schema_field_name in LLM_SCHEMA_FIELD_NAMES:
        embedding_column_name_mapping = getattr(schema, llm_schema_field_name)
        if isinstance(embedding_column_name_mapping, EmbeddingColumnNames):
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
    parsed_schema = replace(schema, excluded_column_names=None, **schema_patch)  # type: ignore
    pred_id_col_name = parsed_schema.prediction_id_column_name
    if pred_id_col_name is None:
        parsed_schema = replace(parsed_schema, prediction_id_column_name="prediction_id")
        parsed_dataframe["prediction_id"] = _add_prediction_id(len(parsed_dataframe))
    elif is_numeric_dtype(parsed_dataframe.dtypes[pred_id_col_name]):
        parsed_dataframe[pred_id_col_name] = parsed_dataframe[pred_id_col_name].astype(str)
    for embedding in (
        [parsed_schema.prompt_column_names, parsed_schema.response_column_names]
        + list(parsed_schema.embedding_feature_column_names.values())
        if parsed_schema.embedding_feature_column_names is not None
        else []
    ):
        if not isinstance(embedding, EmbeddingColumnNames):
            continue
        vector_column_name = embedding.vector_column_name
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
    is converted to UTC timezone-aware timestamp. If the input dataframe and schema do not contain
    timestamps, the default timestamp is used. If a timestamp is timezone-naive, it is localized
    as per local timezone and then converted to UTC
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
    else:
        timestamp_column = normalize_timestamps(
            dataframe[timestamp_column_name],
        )
    dataframe[timestamp_column_name] = timestamp_column
    return dataframe, schema


def _get_schema_from_unknown_schema_param(schemaLike: SchemaLike) -> Schema:
    """
    Compatibility function for converting from arize.utils.types.Schema to phoenix.inferences.Schema
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


# A dataset with no data. Useful for stubs
EMPTY_INFERENCES = Inferences(pd.DataFrame(), schema=Schema())
