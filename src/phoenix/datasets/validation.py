from typing import List

import numpy as np
from pandas import DataFrame, Series
from pandas.api.types import is_datetime64_any_dtype as is_datetime
from pandas.api.types import is_numeric_dtype, is_string_dtype

from . import errors as err
from .schema import Schema


def _check_valid_schema(schema: Schema) -> List[err.ValidationError]:
    errs: List[str] = []
    if schema.excludes is None:
        return []

    if schema.timestamp_column_name in schema.excludes:
        errs.append(
            f"{schema.timestamp_column_name} cannot be excluded because "
            f"it is already being used as the timestamp column"
        )

    if schema.prediction_id_column_name in schema.excludes:
        errs.append(
            f"{schema.prediction_id_column_name} cannot be excluded because "
            f"it is already being used as the prediction id column"
        )

    if len(errs) > 0:
        return [err.InvalidSchemaError(errs)]

    return []


def validate_dataset_inputs(dataframe: DataFrame, schema: Schema) -> List[err.ValidationError]:
    errors = _check_missing_columns(dataframe, schema)
    if errors:
        return errors
    errors = _check_column_types(dataframe, schema)
    if errors:
        return errors
    errors = _check_valid_schema(schema)
    if errors:
        return errors
    errors = _check_valid_embedding_data(dataframe, schema)
    if errors:
        return errors
    return []


def _check_valid_embedding_data(dataframe: DataFrame, schema: Schema) -> List[err.ValidationError]:
    embedding_col_names = schema.embedding_feature_column_names
    if embedding_col_names is None:
        return []

    embedding_errors: List[str] = []
    for embedding_name, column_names in embedding_col_names.items():
        vector_length = None
        current_vector = dataframe[column_names.vector_column_name]

        # Fail if vector is not of supported iterable type
        if not any(isinstance(current_vector, t) for t in (list, np.ndarray, Series)):
            embedding_errors.append(
                f'Embedding feature "{embedding_name}" has vector type {type(current_vector)}. Must be list, '
                f"np.ndarray or pd.Series"
            )
            continue

        # Fail if not all elements in every vector are int/floats
        allowed_types = (int, float, np.int16, np.int32, np.float16, np.float32)
        if not all(isinstance(val, allowed_types) for val in current_vector):
            embedding_errors.append(
                f"Embedding vector must be a vector of integers and/or floats. Got "
                f"{embedding_name}.vector = {current_vector}"
            )
            continue

        # Fail if vectors in the dataframe are not of the same length, or of length < 1
        if vector_length is not None and len(current_vector) != vector_length:
            embedding_errors.append(
                f"Embedding vectors must be of same length. "
                f"{embedding_name}.vector = {current_vector}"
            )
        else:
            vector_length = len(current_vector)
            if vector_length <= 1:
                embedding_errors.append(
                    f"Embedding vectors must be greater than 1. "
                    f"{embedding_name}.vector = {vector_length}"
                )

    if len(embedding_errors) > 0:
        return [err.InvalidSchemaError(embedding_errors)]
    return []


def _check_column_types(dataframe: DataFrame, schema: Schema) -> List[err.ValidationError]:
    wrong_type_cols: List[str] = []
    if schema.timestamp_column_name is not None:
        if not (
            is_numeric_dtype(dataframe.dtypes[schema.timestamp_column_name])
            or is_datetime(dataframe.dtypes[schema.timestamp_column_name])
        ):
            wrong_type_cols.append(
                f"{schema.timestamp_column_name} should be of timestamp or numeric type"
            )

    if schema.prediction_id_column_name is not None:
        if not (
            is_numeric_dtype(dataframe.dtypes[schema.prediction_id_column_name])
            or is_string_dtype(dataframe.dtypes[schema.prediction_id_column_name])
        ):
            wrong_type_cols.append(
                f"{schema.prediction_id_column_name} should be a string or numeric type"
            )

    if len(wrong_type_cols) > 0:
        return [err.InvalidColumnType(wrong_type_cols)]
    return []


def _check_missing_columns(dataframe: DataFrame, schema: Schema) -> List[err.ValidationError]:
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
