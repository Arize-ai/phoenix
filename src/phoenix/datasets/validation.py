#                    Copyright 2023 Arize AI and contributors.
#                     Licensed under the Elastic License 2.0;
#   you may not use this file except in compliance with the Elastic License 2.0.

from itertools import chain
from typing import List

from pandas import DataFrame

from . import errors as err
from .schema import Schema


def validate_dataset_inputs(dataframe: DataFrame, schema: Schema) -> List[err.ValidationError]:
    general_checks = chain(check_missing_columns(dataframe, schema))
    return list(general_checks)


def check_missing_columns(dataframe: DataFrame, schema: Schema) -> List[err.MissingColumns]:
    # converting to a set first makes the checks run a lot faster
    existing_columns = set(dataframe.columns)
    missing_columns = []

    for field in schema.__dict__:
        if field.endswith("column_name"):
            col = getattr(schema, field)
            if col is not None and col not in existing_columns:
                missing_columns.append(col)

    if schema.feature_column_names is not None:
        for col in schema.feature_column_names:
            if col not in existing_columns:
                missing_columns.append(col)

    if schema.embedding_feature_column_names is not None:
        for emb_col_names in schema.embedding_feature_column_names.values():
            if emb_col_names.vector_column_name not in existing_columns:
                missing_columns.append(emb_col_names.vector_column_name)
            if (
                emb_col_names.raw_data_column_name is not None
                and emb_col_names.raw_data_column_name not in existing_columns
            ):
                missing_columns.append(emb_col_names.raw_data_column_name)
            if (
                emb_col_names.link_to_data_column_name is not None
                and emb_col_names.link_to_data_column_name not in existing_columns
            ):
                missing_columns.append(emb_col_names.link_to_data_column_name)

    if missing_columns:
        return [err.MissingColumns(missing_columns)]
    return []
