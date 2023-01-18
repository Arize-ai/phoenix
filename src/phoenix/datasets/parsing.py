import logging
from copy import deepcopy
from dataclasses import fields, replace
from typing import Dict, List, Optional, Set, Tuple

from pandas import DataFrame

from .schema import EmbeddingFeatures, Schema, SchemaFieldName, SchemaFieldValue

logger = logging.getLogger(__name__)


def parse_dataframe_and_schema(dataframe: DataFrame, schema: Schema) -> Tuple[DataFrame, Schema]:
    """
    Parses `dataframe` according to `schema`.

    Removes column names in `schema.excludes` from the input dataframe and
    schema. To remove an embedding feature and all associated columns, add the
    name of the embedding feature to `schema.excludes` rather than the
    associated column names. If `schema.feature_column_names` is `None`,
    automatically discovers features by adding all column names present in the
    dataframe but not included in any other schema fields.
    """

    # Initialize state
    unseen_excludes: Set[str] = set(schema.excludes) if schema.excludes is not None else set()
    unseen_column_names: Set[str] = set(dataframe.columns.to_list())
    column_name_to_include: Dict[str, bool] = {}
    schema_field_name_to_replace_value: Dict[SchemaFieldName, SchemaFieldValue] = {}

    single_column_schema_field_names = [
        "prediction_id_column_name",
        "timestamp_column_name",
        "prediction_label_column_name",
        "prediction_score_column_name",
        "actual_label_column_name",
        "actual_score_column_name",
    ]
    for schema_field_name in single_column_schema_field_names:
        _check_single_column_schema_field_for_excludes(
            schema,
            schema_field_name,
            unseen_excludes,
            schema_field_name_to_replace_value,
            column_name_to_include,
            unseen_column_names,
        )

    multi_column_schema_field_names = ["feature_column_names", "tag_column_names"]
    for schema_field_name in multi_column_schema_field_names:
        _check_multi_column_schema_field_for_excludes(
            schema,
            schema_field_name,
            unseen_excludes,
            schema_field_name_to_replace_value,
            column_name_to_include,
            unseen_column_names,
        )

    if schema.embedding_feature_column_names:
        _check_embedding_features_schema_field_for_excludes(
            schema.embedding_feature_column_names,
            unseen_excludes,
            schema_field_name_to_replace_value,
            column_name_to_include,
            unseen_column_names,
        )

    if not schema.feature_column_names and unseen_column_names:
        _discover_feature_columns(
            dataframe,
            unseen_excludes,
            schema_field_name_to_replace_value,
            column_name_to_include,
            unseen_column_names,
        )

    if unseen_excludes:
        logger.warning(
            "The following columns and embedding features were excluded in the schema but were "
            "not found in the dataframe: {}".format(", ".join(unseen_excludes))
        )

    parsed_dataframe, parsed_schema = _create_parsed_dataframe_and_schema(
        dataframe, schema, schema_field_name_to_replace_value, column_name_to_include
    )

    return parsed_dataframe, parsed_schema


def _check_single_column_schema_field_for_excludes(
    schema: Schema,
    schema_field_name: str,
    unseen_excludes: Set[str],
    schema_field_name_to_replaced_value: Dict[SchemaFieldName, SchemaFieldValue],
    column_name_to_include: Dict[str, bool],
    unseen_column_names: Set[str],
) -> None:
    """
    Checks the `schema_field_name` on `schema` for excludes and updates state.
    """
    column_name: str = getattr(schema, schema_field_name)
    include_column: bool = column_name not in unseen_excludes
    column_name_to_include[column_name] = include_column
    if not include_column:
        schema_field_name_to_replaced_value[schema_field_name] = None
        unseen_excludes.discard(column_name)
        logger.debug(f"excluded {schema_field_name}: {column_name}")
    unseen_column_names.discard(column_name)


def _check_multi_column_schema_field_for_excludes(
    schema: Schema,
    schema_field_name: str,
    unseen_excludes: Set[str],
    schema_field_name_to_replaced_value: Dict[SchemaFieldName, SchemaFieldValue],
    column_name_to_include: Dict[str, bool],
    unseen_column_names: Set[str],
) -> None:
    """
    Checks the columns associated with `schema_field_name` on `schema` for
    excludes and updates state.
    """
    column_names: Optional[List[str]] = getattr(schema, schema_field_name)
    if column_names:
        included_column_names: List[str] = []
        excluded_column_names: List[str] = []
        for column_name in column_names:
            is_included_column = column_name not in unseen_excludes
            column_name_to_include[column_name] = is_included_column
            if is_included_column:
                included_column_names.append(column_name)
            else:
                excluded_column_names.append(column_name)
                unseen_excludes.discard(column_name)
                logger.debug(f"excluded {schema_field_name}: {column_name}")
            unseen_column_names.discard(column_name)
        schema_field_name_to_replaced_value[schema_field_name] = (
            included_column_names if included_column_names else None
        )


def _check_embedding_features_schema_field_for_excludes(
    embedding_features: EmbeddingFeatures,
    unseen_excludes: Set[str],
    schema_field_name_to_replace_value: Dict[SchemaFieldName, SchemaFieldValue],
    column_name_to_include: Dict[str, bool],
    unseen_column_names: Set[str],
) -> None:
    """
    Check embedding features for excludes and update state.
    """
    included_embedding_features: EmbeddingFeatures = {}
    for (
        embedding_feature_name,
        embedding_column_name_mapping,
    ) in embedding_features.items():
        include_embedding_feature = embedding_feature_name not in unseen_excludes
        if include_embedding_feature:
            included_embedding_features[embedding_feature_name] = deepcopy(
                embedding_column_name_mapping
            )
        else:
            unseen_excludes.discard(embedding_feature_name)

        for embedding_field in fields(embedding_column_name_mapping):
            column_name: Optional[str] = getattr(
                embedding_column_name_mapping, embedding_field.name
            )
            if column_name is not None:
                column_name_to_include[column_name] = include_embedding_feature
                if column_name != embedding_feature_name and column_name in unseen_excludes:
                    logger.warning(
                        f"Excluding embedding feature columns such as "
                        f'"{column_name}" has no effect; instead exclude the '
                        f'corresponding embedding feature name "{embedding_feature_name}".'
                    )
                    unseen_excludes.discard(column_name)
                unseen_column_names.discard(column_name)
    schema_field_name_to_replace_value["embedding_feature_column_names"] = (
        included_embedding_features if included_embedding_features else None
    )


def _discover_feature_columns(
    dataframe: DataFrame,
    unseen_excludes: Set[str],
    schema_field_name_to_replace_value: Dict[SchemaFieldName, SchemaFieldValue],
    column_name_to_include: Dict[str, bool],
    unseen_column_names: Set[str],
) -> None:
    """
    Updates state assuming that unseen dataframe columns are features.
    """
    discovered_feature_column_names = []
    for column_name in unseen_column_names:
        if column_name not in unseen_excludes:
            discovered_feature_column_names.append(column_name)
            column_name_to_include[column_name] = True
        else:
            unseen_excludes.discard(column_name)
            logger.debug(f"excluded feature: {column_name}")
    original_column_positions: List[int] = dataframe.columns.get_indexer(
        discovered_feature_column_names
    )  # type: ignore
    feature_column_name_to_position: Dict[str, int] = dict(
        zip(discovered_feature_column_names, original_column_positions)
    )
    discovered_feature_column_names.sort(key=lambda col: feature_column_name_to_position[col])
    schema_field_name_to_replace_value["feature_column_names"] = discovered_feature_column_names
    logger.debug(
        "Discovered feature column names: {}".format(", ".join(discovered_feature_column_names))
    )


def _create_parsed_dataframe_and_schema(
    dataframe: DataFrame,
    schema: Schema,
    schema_field_name_to_replaced_value: Dict[SchemaFieldName, SchemaFieldValue],
    column_name_to_include: Dict[str, bool],
) -> Tuple[DataFrame, Schema]:
    """
    Creates new dataframe and schema objects to reflect exclusions and
    discovered features.
    """
    included_column_names: List[str] = []
    for column_name in dataframe.columns:
        if column_name_to_include.get(str(column_name), False):
            included_column_names.append(str(column_name))
    parsed_dataframe = dataframe[included_column_names]
    parsed_schema = replace(schema, excludes=None, **schema_field_name_to_replaced_value)
    return parsed_dataframe, parsed_schema
