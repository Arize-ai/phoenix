import math
from typing import List

import numpy as np
from pandas import DataFrame, Series
from pandas.api.types import is_numeric_dtype, is_string_dtype

from . import errors as err
from .schema import EmbeddingColumnNames, Schema

RESERVED_EMBEDDING_NAMES = ("prompt", "response")


def _check_valid_schema(schema: Schema) -> List[err.ValidationError]:
    errs: List[str] = []
    if schema.excluded_column_names is None:
        return []

    if schema.timestamp_column_name in schema.excluded_column_names:
        errs.append(
            f"{schema.timestamp_column_name} cannot be excluded because "
            f"it is already being used as the timestamp column"
        )

    if schema.prediction_id_column_name in schema.excluded_column_names:
        errs.append(
            f"{schema.prediction_id_column_name} cannot be excluded because "
            f"it is already being used as the prediction id column"
        )

    if len(errs) > 0:
        return [err.InvalidSchemaError(errs)]

    return []


def validate_inferences_inputs(dataframe: DataFrame, schema: Schema) -> List[err.ValidationError]:
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
    errors = _check_valid_prompt_response_data(dataframe, schema)
    if errors:
        return errors
    return []


def _check_valid_embedding_data(dataframe: DataFrame, schema: Schema) -> List[err.ValidationError]:
    embedding_col_names = schema.embedding_feature_column_names
    if embedding_col_names is None:
        return []

    embedding_errors: List[err.ValidationError] = []
    for embedding_name, column_names in embedding_col_names.items():
        if embedding_name in RESERVED_EMBEDDING_NAMES:
            embedding_errors += _validate_reserved_embedding_name(embedding_name, schema)
        embedding_errors += _validate_embedding_vector(
            dataframe, embedding_name, column_names.vector_column_name
        )

    return embedding_errors


def _check_valid_prompt_response_data(
    dataframe: DataFrame, schema: Schema
) -> List[err.ValidationError]:
    prompt_response_errors: List[err.ValidationError] = []

    prompt_response_column_names = {
        "prompt": schema.prompt_column_names,
        "response": schema.response_column_names,
    }
    for name, column_names in prompt_response_column_names.items():
        if isinstance(column_names, EmbeddingColumnNames):
            prompt_response_errors += _validate_embedding_vector(
                dataframe, name, column_names.vector_column_name
            )

    return prompt_response_errors


def _validate_reserved_embedding_name(
    embedding_name: str, schema: Schema
) -> List[err.ValidationError]:
    if embedding_name == "prompt" and schema.prompt_column_names is not None:
        return [err.InvalidEmbeddingReservedName(embedding_name, "schema.prompt_column_names")]
    elif embedding_name == "response" and schema.response_column_names is not None:
        return [err.InvalidEmbeddingReservedName(embedding_name, "schema.response_column_names")]
    return []


def _validate_embedding_vector(
    dataframe: DataFrame, name: str, vector_column_name: str
) -> List[err.ValidationError]:
    vector_column = dataframe[vector_column_name]
    errors: List[err.ValidationError] = []
    vector_length = None

    for vector in vector_column:
        vector_is_missing = vector is None or (isinstance(vector, float) and math.isnan(vector))
        if vector_is_missing:
            continue

        # Fail if vector is not of supported iterable type
        if not isinstance(vector, (list, np.ndarray, Series)):
            errors.append(
                err.InvalidEmbeddingVectorDataType(
                    embedding_feature_name=name,
                    vector_column_type=str(type(vector)),
                )
            )
            break

        # Fail if not all elements in every vector are int/floats
        allowed_types = (int, float, np.int16, np.int32, np.float16, np.float32)
        if not all(isinstance(val, allowed_types) for val in vector):
            errors.append(
                err.InvalidEmbeddingVectorValuesDataType(
                    embedding_feature_name=name,
                    vector_column_name=vector_column_name,
                    vector=vector,
                )
            )
            break

        if vector_length is None:
            vector_length = len(vector)

        # Fail if vectors in the dataframe are not of the same length, or of length <= 1
        if len(vector) != vector_length:
            errors.append(
                err.EmbeddingVectorSizeMismatch(
                    name,
                    vector_column_name,
                    [vector_length, len(vector)],
                )
            )
            break
        elif vector_length <= 1:
            errors.append(
                err.InvalidEmbeddingVectorSize(
                    name,
                    vector_column_name,
                    vector_length,
                )
            )
            break
    return errors


def _check_column_types(dataframe: DataFrame, schema: Schema) -> List[err.ValidationError]:
    wrong_type_cols: List[str] = []
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

    for column_names in (schema.prompt_column_names, schema.response_column_names):
        if isinstance(column_names, EmbeddingColumnNames):
            if column_names.vector_column_name not in existing_columns:
                missing_columns.append(column_names.vector_column_name)
            if (
                column_names.raw_data_column_name is not None
                and column_names.raw_data_column_name not in existing_columns
            ):
                missing_columns.append(column_names.raw_data_column_name)
            if (
                column_names.link_to_data_column_name is not None
                and column_names.link_to_data_column_name not in existing_columns
            ):
                missing_columns.append(column_names.link_to_data_column_name)

    if missing_columns:
        return [err.MissingColumns(missing_columns)]

    return []
