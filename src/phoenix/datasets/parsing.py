import logging
from copy import deepcopy
from dataclasses import Field, fields, replace
from typing import Any, Dict, List, Optional, Set, Tuple

from pandas import DataFrame

from .schema import EmbeddingColumnNames, Schema

logger = logging.getLogger(__name__)


def exclude_columns_and_discover_features(
    dataframe: DataFrame, schema: Schema
) -> Tuple[DataFrame, Schema]:

    # Check scalar schema fields, features and tags for excludes
    schema_field_name_to_replaced_value: Dict[str, Any] = {}
    excludes: Set[str] = set(schema.excludes) if schema.excludes is not None else set()
    unvisited_column_names: Set[str] = set(dataframe.columns.to_list())
    column_name_to_include_flag: Dict[str, bool] = {}
    for schema_field in fields(schema):
        schema_field_name = schema_field.name
        if _is_scalar_field(schema, schema_field_name):
            column_name: str = getattr(schema, schema_field_name)
            include_column = column_name not in excludes
            column_name_to_include_flag[column_name] = include_column
            if not include_column:
                schema_field_name_to_replaced_value[schema_field_name] = None
                excludes.discard(column_name)
            unvisited_column_names.discard(column_name)
        elif schema_field_name in ["feature_column_names", "tag_column_names"]:
            column_names: Optional[List[str]] = getattr(schema, schema_field_name)
            if column_names:
                _exclude_columns(
                    schema=schema,
                    schema_field_name=schema_field_name,
                    column_name_to_include_flag=column_name_to_include_flag,
                    excludes=excludes,
                    unvisited_column_names=unvisited_column_names,
                    schema_field_name_to_replaced_value=schema_field_name_to_replaced_value,
                )

    # Check embedding features for excludes
    if schema.embedding_feature_column_names:
        embedding_feature_name: str
        included_embedding_features: Dict[str, EmbeddingColumnNames] = {}
        embedding_column_name_mapping: EmbeddingColumnNames
        for (
            embedding_feature_name,
            embedding_column_name_mapping,
        ) in schema.embedding_feature_column_names.items():
            include_embedding_feature = embedding_feature_name not in excludes
            if include_embedding_feature:
                included_embedding_features[embedding_feature_name] = deepcopy(
                    embedding_column_name_mapping
                )
            else:
                excludes.discard(embedding_feature_name)
            embedding_field: Field[str]
            for embedding_field in fields(embedding_column_name_mapping):
                embedding_column_name: Optional[str] = getattr(
                    embedding_column_name_mapping, embedding_field.name
                )
                if embedding_column_name is not None:
                    column_name_to_include_flag[embedding_column_name] = include_embedding_feature
                    if (
                        embedding_column_name != embedding_feature_name
                        and embedding_column_name in excludes
                    ):
                        logger.warning(
                            f"Excluding embedding feature columns such as "
                            f'"{embedding_column_name}" has no effect; instead exclude the '
                            f'corresponding embedding feature name "{embedding_feature_name}".'
                        )
                    unvisited_column_names.discard(embedding_column_name)
        schema_field_name_to_replaced_value["embedding_feature_column_names"] = (
            included_embedding_features if included_embedding_features else None
        )

    # Automatically discover feature columns if they are not explicitly defined
    if not schema.feature_column_names and unvisited_column_names:
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
        schema_field_name_to_replaced_value[
            "feature_column_names"
        ] = discovered_feature_column_names
        logger.info(
            f"Automatically discovered {len(discovered_feature_column_names)} feature columns."
        )
        logger.debug(
            "Discovered feature column names: {}".format(", ".join(discovered_feature_column_names))
        )

    # Warn user if any excludes were not found in the dataframe
    if excludes:
        logger.warning(
            "The following columns and embedding features were excluded in the schema but were "
            "not found in the dataframe: {}".format(", ".join(excludes))
        )

    # Update dataframe and schema
    included_column_names: List[str] = [
        col for col in dataframe.columns if column_name_to_include_flag.get(col, False)
    ]  # type: ignore
    parsed_dataframe = dataframe[included_column_names]
    parsed_schema = replace(schema, excludes=None, **schema_field_name_to_replaced_value)

    return parsed_dataframe, parsed_schema


def _exclude_columns(
    schema: Schema,
    schema_field_name: str,
    column_name_to_include_flag: Dict[str, bool],
    excludes: Set[str],
    unvisited_column_names: Set[str],
    schema_field_name_to_replaced_value: Dict[str, Any],
) -> None:
    column_names = getattr(schema, schema_field_name)
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
        logger.info(
            "excluded {field_name}: {excluded_column_names}".format(
                field_name=schema_field_name, excluded_column_names=", ".join(excluded_column_names)
            )
        )
    schema_field_name_to_replaced_value[schema_field_name] = included_column_names
    column_name_to_include_flag.update(field_column_name_to_include_flag)


def _is_scalar_field(schema: Schema, field_name: str) -> bool:
    schema_field_value = getattr(schema, field_name)
    return isinstance(schema_field_value, str) or isinstance(schema_field_value, float)
