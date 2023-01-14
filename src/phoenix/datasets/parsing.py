import logging
from copy import deepcopy
from dataclasses import Field, fields, replace
from typing import Any, Dict, List, Optional, Set, Tuple

from pandas import DataFrame

from .schema import EmbeddingColumnNames, Schema

logger = logging.getLogger(__name__)


EmbeddingFeatures = Dict[str, EmbeddingColumnNames]


def parse_dataframe_and_schema(dataframe: DataFrame, schema: Schema) -> Tuple[DataFrame, Schema]:
    """
    Parses `dataframe` according to `schema`.

    Removes column names in `schema.excludes` from the input dataframe. To
    remove an embedding feature and all associated columns, add the name of the
    embedding feature to `schema.excludes` rather than the individual embedding
    feature column names. If `schema.feature_column_names` is `None`,
    automatically discovers features by adding all column names present in the
    dataframe but not included in any other schema fields to
    `schema.feature_column_names`.
    """

    excludes: Set[str] = set(schema.excludes) if schema.excludes is not None else set()
    schema_field_name_to_replaced_value: Dict[str, Any] = {}
    unvisited_column_names: Set[str] = set(dataframe.columns.to_list())
    column_name_to_include_flag: Dict[str, bool] = {}

    # Check single-column schema fields for excludes
    for schema_field in fields(schema):
        schema_field_name = schema_field.name
        if _is_single_column_schema_field(schema_field_name, schema):
            _check_single_column_schema_field_for_excludes(
                schema,
                schema_field_name,
                excludes,
                schema_field_name_to_replaced_value,
                column_name_to_include_flag,
                unvisited_column_names,
            )

    # Check features and tags for excludes
    for schema_field_name in ["feature_column_names", "tag_column_names"]:
        _check_multi_column_schema_field_for_excludes(
            schema,
            schema_field_name,
            excludes,
            schema_field_name_to_replaced_value,
            column_name_to_include_flag,
            unvisited_column_names,
        )

    # Check embedding features for excludes
    if schema.embedding_feature_column_names:
        _check_embedding_features_schema_field_for_excludes(
            schema.embedding_feature_column_names,
            excludes,
            schema_field_name_to_replaced_value,
            column_name_to_include_flag,
            unvisited_column_names,
        )

    # Automatically discover feature columns if they are not explicitly defined
    if not schema.feature_column_names and unvisited_column_names:
        _discover_feature_columns(
            dataframe,
            excludes,
            schema_field_name_to_replaced_value,
            column_name_to_include_flag,
            unvisited_column_names,
        )

    # Warn user if any excludes were not found in the dataframe
    if excludes:
        logger.warning(
            "The following columns and embedding features were excluded in the schema but were "
            "not found in the dataframe: {}".format(", ".join(excludes))
        )

    # Create updated dataframe and schema
    parsed_dataframe, parsed_schema = _create_parsed_dataframe_and_schema(
        dataframe, schema, schema_field_name_to_replaced_value, column_name_to_include_flag
    )

    return parsed_dataframe, parsed_schema


def _is_single_column_schema_field(field_name: str, schema: Schema) -> bool:
    """
    Checks whether `field_name` refers to a single-column field on `schema`.
    For example, `prediction_id_column_name` is a single-column field while
    `feature_column_names` is not.
    """
    schema_field_value = getattr(schema, field_name)
    return isinstance(schema_field_value, str)


def _check_single_column_schema_field_for_excludes(
    schema: Schema,
    schema_field_name: str,
    excludes: Set[str],
    schema_field_name_to_replaced_value: Dict[str, Any],
    column_name_to_include_flag: Dict[str, bool],
    unvisited_column_names: Set[str],
) -> None:
    """
    Checks the `schema_field_name` on `schema` for excludes and updates state.
    """
    column_name: str = getattr(schema, schema_field_name)
    include_column: bool = column_name not in excludes
    column_name_to_include_flag[column_name] = include_column
    if not include_column:
        schema_field_name_to_replaced_value[schema_field_name] = None
        excludes.discard(column_name)
        logger.debug(f"excluded {schema_field_name}: {column_name}")
    unvisited_column_names.discard(column_name)


def _check_multi_column_schema_field_for_excludes(
    schema: Schema,
    schema_field_name: str,
    excludes: Set[str],
    schema_field_name_to_replaced_value: Dict[str, Optional[List[str]]],
    column_name_to_include_flag: Dict[str, bool],
    unvisited_column_names: Set[str],
) -> None:
    """
    Checks the columns associated with `schema_field_name` on `schema` for
    excludes and updates state.
    """
    column_names: Optional[List[str]] = getattr(schema, schema_field_name)
    if column_names:
        field_column_name_to_include_flag: Dict[str, bool] = {}
        included_column_names: List[str] = []
        excluded_column_names: List[str] = []
        for column_name in column_names:
            is_included_column = column_name not in excludes
            field_column_name_to_include_flag[column_name] = is_included_column
            if is_included_column:
                included_column_names.append(column_name)
            else:
                excluded_column_names.append(column_name)
                excludes.discard(column_name)
            unvisited_column_names.discard(column_name)
        if excludes:
            logger.debug(
                "excluded {field_name}: {excluded_column_names}".format(
                    field_name=schema_field_name,
                    excluded_column_names=", ".join(excluded_column_names),
                )
            )
        schema_field_name_to_replaced_value[schema_field_name] = included_column_names
        column_name_to_include_flag.update(field_column_name_to_include_flag)


def _check_embedding_features_schema_field_for_excludes(
    embedding_features: EmbeddingFeatures,
    excludes: Set[str],
    schema_field_name_to_replaced_value: Dict[str, Optional[EmbeddingFeatures]],
    column_name_to_include_flag: Dict[str, bool],
    unvisited_column_names: Set[str],
) -> None:
    """
    Check embedding features for excludes and update state.
    """
    included_embedding_features: EmbeddingFeatures = {}
    for (
        embedding_feature_name,
        embedding_column_name_mapping,
    ) in embedding_features.items():
        include_embedding_feature = embedding_feature_name not in excludes
        if include_embedding_feature:
            included_embedding_features[embedding_feature_name] = deepcopy(
                embedding_column_name_mapping
            )
        else:
            excludes.discard(embedding_feature_name)
        embedding_field: Field[str]
        for embedding_field in fields(embedding_column_name_mapping):
            column_name: Optional[str] = getattr(
                embedding_column_name_mapping, embedding_field.name
            )
            if column_name is not None:
                column_name_to_include_flag[column_name] = include_embedding_feature
                if column_name != embedding_feature_name and column_name in excludes:
                    logger.warning(
                        f"Excluding embedding feature columns such as "
                        f'"{column_name}" has no effect; instead exclude the '
                        f'corresponding embedding feature name "{embedding_feature_name}".'
                    )
                unvisited_column_names.discard(column_name)
    schema_field_name_to_replaced_value["embedding_feature_column_names"] = (
        included_embedding_features if included_embedding_features else None
    )


def _discover_feature_columns(
    dataframe: DataFrame,
    excludes: Set[str],
    schema_field_name_to_replaced_value: Dict[str, Any],
    column_name_to_include_flag: Dict[str, bool],
    unvisited_column_names: Set[str],
) -> None:
    """
    Updates state assuming that unseen dataframe columns are features.
    """
    discovered_feature_column_names = []
    for column_name in unvisited_column_names:
        if column_name not in excludes:
            discovered_feature_column_names.append(column_name)
            column_name_to_include_flag[column_name] = True
        else:
            excludes.discard(column_name)
    original_column_positions: List[int] = dataframe.columns.get_indexer(
        discovered_feature_column_names
    )  # type: ignore
    feature_column_name_to_position: Dict[str, int] = dict(
        zip(discovered_feature_column_names, original_column_positions)
    )
    discovered_feature_column_names.sort(key=lambda col: feature_column_name_to_position[col])
    schema_field_name_to_replaced_value["feature_column_names"] = discovered_feature_column_names
    logger.info(f"Automatically discovered {len(discovered_feature_column_names)} feature columns.")
    logger.debug(
        "Discovered feature column names: {}".format(", ".join(discovered_feature_column_names))
    )


def _create_parsed_dataframe_and_schema(
    dataframe: DataFrame,
    schema: Schema,
    schema_field_name_to_replaced_value: Dict[str, Any],
    column_name_to_include_flag: Dict[str, bool],
) -> Tuple[DataFrame, Schema]:
    """
    Creates new dataframe and schema objects to reflect exclusions and
    discovered features.
    """
    included_column_names: List[str] = []
    for col in dataframe.columns:
        if column_name_to_include_flag.get(str(col), False):
            included_column_names.append(str(col))
    parsed_dataframe = dataframe[included_column_names]
    parsed_schema = replace(schema, excludes=None, **schema_field_name_to_replaced_value)
    return parsed_dataframe, parsed_schema
