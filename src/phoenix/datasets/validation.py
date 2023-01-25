from itertools import chain
from typing import Generator, List

from pandas import DataFrame
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


def validate_dataset_inputs(
    dataframe: DataFrame, schema: Schema
) -> Generator[List[err.ValidationError], None, None]:
    yield _check_missing_columns(dataframe, schema)
    yield _check_column_types(dataframe, schema)
    yield _check_valid_schema(schema)


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


def _check_missing_columns(dataframe: DataFrame, schema: Schema) -> List[err.MissingColumns]:
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
