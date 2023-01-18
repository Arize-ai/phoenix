"""
Test dataset
"""

import random
import uuid
from functools import partial

import numpy as np
import pandas as pd
import pytest
from numpy.testing import assert_array_almost_equal
from pytest_lazyfixture import lazy_fixture

from phoenix.datasets.dataset import Dataset, EmbeddingColumnNames, Schema
from phoenix.datasets.errors import DatasetError

num_samples = 9


@pytest.fixture
def random_seed():
    np.random.seed(0)
    random.seed(0)


@pytest.fixture
def include_embeddings(request):
    return request.param


@pytest.fixture
def expected_df(include_embeddings, random_seed):
    embedding_dimension = 15

    ts = pd.Timestamp.now()
    data = {
        "prediction_id": [str(n) for n in range(num_samples)],
        "timestamp": [ts for _ in range(num_samples)],
        "feature0": [random.random() for _ in range(num_samples)],
        "feature1": [random.random() for _ in range(num_samples)],
        "predicted_score": [random.random() for _ in range(num_samples)],
    }
    if include_embeddings:
        data["embeddings"] = [np.random.rand(embedding_dimension) for _ in range(num_samples)]
    return pd.DataFrame.from_dict(data)


@pytest.fixture
def pyarrow_parquet_path(expected_df, tmp_path):
    path = tmp_path / "data_pyarrow.parquet"
    expected_df.to_parquet(path, engine="pyarrow")
    return path


@pytest.fixture
def fastparquet_path(include_embeddings, expected_df, tmp_path):
    path = tmp_path / "data_fastparquet.parquet"
    if include_embeddings:
        expected_df["embeddings"] = expected_df["embeddings"].map(
            list
        )  # Necessary due to a quirk in the fastparquet writer.
    expected_df.to_parquet(path, engine="fastparquet")
    return path


@pytest.fixture
def schema(include_embeddings):
    kwargs = {
        "prediction_id_column_name": "prediction_id",
        "timestamp_column_name": "timestamp",
        "feature_column_names": ["feature0", "feature1"],
        "prediction_score_column_name": "predicted_score",
    }
    if include_embeddings:
        kwargs["embedding_feature_column_names"] = {
            "embedding_feature_name": EmbeddingColumnNames(vector_column_name="embeddings")
        }
    return Schema(**kwargs)


@pytest.mark.parametrize(
    "include_embeddings, initialization_class_method, filepath",
    [
        (
            True,
            partial(Dataset.from_parquet, engine="pyarrow"),
            lazy_fixture("pyarrow_parquet_path"),
        ),
        (
            True,
            partial(Dataset.from_parquet, engine="fastparquet"),
            lazy_fixture("fastparquet_path"),
        ),
        (
            False,
            partial(Dataset.from_parquet, engine="pyarrow"),
            lazy_fixture("pyarrow_parquet_path"),
        ),
        (
            False,
            partial(Dataset.from_parquet, engine="fastparquet"),
            lazy_fixture("fastparquet_path"),
        ),
    ],
    ids=[
        "test_dataset_from_parquet_with_pyarrow_engine_correctly_loads_data_with_embeddings",
        "test_dataset_from_parquet_with_fastparquet_engine_correctly_loads_data_with_embeddings",
        "test_dataset_from_parquet_with_pyarrow_engine_correctly_loads_data_without_embeddings",
        "test_dataset_from_parquet_with_fastparquet_engine_correctly_loads_data_without_embeddings",
    ],
)
def test_dataset_from_parquet_correctly_load_data_with_and_without_embeddings(
    include_embeddings,
    initialization_class_method,
    filepath,
    expected_df,
    schema,
):
    dataset_name = "dataset-name"
    dataset = initialization_class_method(filepath=filepath, schema=schema, name=dataset_name)

    assert dataset.name == dataset_name
    for column_name in expected_df.columns:
        assert column_name in dataset.dataframe
        actual_column = dataset.dataframe[column_name]
        expected_column = expected_df[column_name]
        assert_column(column_name, actual_column, expected_column)


def assert_column(column_name, actual_column, expected_column):
    if column_name == "embeddings":
        assert_embedding_columns_almost_equal(actual_column, expected_column)
    elif column_name == "timestamp":
        pd.testing.assert_series_equal(actual_column, expected_column)
    elif column_name == "prediction_id":
        pd.testing.assert_series_equal(actual_column, expected_column)
    else:
        assert_non_embedding_columns_almost_equal(actual_column, expected_column)


def assert_non_embedding_columns_almost_equal(actual_column, expected_column):
    """
    Rows of dataframe may have been permuted after ingestion, hence the values must be sorted to
    compare.
    """
    assert_array_almost_equal(actual_column.sort_values(), expected_column.sort_values())


def assert_embedding_columns_almost_equal(actual_embeddings_columns, expected_embeddings_column):
    """
    Rows of dataframe may have been permuted after ingestion, hence the embeddings are sorted by
    their first entry before comparing.
    """
    actual_embeddings_columns = actual_embeddings_columns.sort_values(
        key=lambda col: col.map(lambda emb: emb[0])
    )
    expected_embeddings_column = expected_embeddings_column.sort_values(
        key=lambda col: col.map(lambda emb: emb[0])
    )
    for actual_embedding, expected_embedding in zip(
        actual_embeddings_columns, expected_embeddings_column
    ):
        assert_array_almost_equal(actual_embedding, expected_embedding)


def random_uuids():
    return [str(uuid.uuid4()) for _ in range(num_samples)]


@pytest.mark.parametrize(
    "input_df, input_schema",
    [
        (
            {
                "timestamp": np.full(
                    shape=num_samples, fill_value=pd.Timestamp.utcnow(), dtype=pd.Timestamp
                ),
                "prediction_id": random_uuids(),
            },
            {"timestamp_column_name": "timestamp", "prediction_id_column_name": "prediction_id"},
        ),
        (
            {
                "timestamp": np.full(
                    shape=num_samples, fill_value=pd.Timestamp.utcnow().timestamp(), dtype=int
                ),
                "prediction_id": random_uuids(),
            },
            {"timestamp_column_name": "timestamp", "prediction_id_column_name": "prediction_id"},
        ),
        (
            {
                "timestamp": np.full(
                    shape=num_samples, fill_value=pd.Timestamp.utcnow(), dtype=pd.Timestamp
                ),
                "prediction_id": range(num_samples),
            },
            {"timestamp_column_name": "timestamp", "prediction_id_column_name": "prediction_id"},
        ),
        (
            {
                "prediction_id": random_uuids(),
            },
            {"prediction_id_column_name": "prediction_id"},
        ),
        (
            {
                "timestamp": np.full(
                    shape=num_samples, fill_value=pd.Timestamp.utcnow(), dtype=pd.Timestamp
                ),
            },
            {"timestamp_column_name": "timestamp"},
        ),
        (
            dict(),
            dict(),
        ),
    ],
    ids=[
        "test_dataset_normalization_columns_already_normalized",
        "test_dataset_normalization_timestamp_integer_to_datetime",
        "test_dataset_normalization_prediction_id_integer_to_string",
        "test_dataset_normalization_add_missing_timestamp",
        "test_dataset_normalization_add_missing_prediction_id",
        "test_dataset_normalization_add_missing_timestamp_and_prediction_id",
    ],
    indirect=True,
)
def test_dataset_normalization(input_df, input_schema) -> None:
    dataset = Dataset(dataframe=input_df, schema=input_schema)

    # Ensure existing data
    for column_name in input_df:
        assert column_name in dataset.dataframe.columns
        actual_column = dataset.dataframe[column_name]
        expected_column = input_df[column_name]
        assert_column(column_name, actual_column, expected_column)

    # Ensure normalized columns exist if they did not exist in the initial normalization_df
    assert "timestamp" in dataset.dataframe
    assert dataset.dataframe.dtypes["timestamp"], "datetime[nz]"
    assert "prediction_id" in dataset.dataframe
    assert dataset.dataframe.dtypes["prediction_id"], "string"


@pytest.mark.parametrize(
    "input_df, input_schema",
    [
        (
            {
                "prediction_id": np.full(
                    shape=num_samples, fill_value=pd.Timestamp.utcnow(), dtype=pd.Timestamp
                ),
            },
            {"prediction_id_column_name": "prediction_id"},
        ),
        (
            {
                "timestamp": random_uuids(),
            },
            {"timestamp_column_name": "timestamp"},
        ),
    ],
    indirect=True,
)
def test_dataset_validation(input_df, input_schema) -> None:
    with pytest.raises(DatasetError):
        Dataset(dataframe=input_df, schema=input_schema)


@pytest.fixture
def input_df(request):
    """
    Provides a dataframe fixture with a base set of columns and an optional configurable set of additional columns
    :param request: params contains the additional columns to add to the dataframe
    :return: pd.DataFrame
    """
    data = {
        "feature": range(num_samples),
        "predicted_score": range(num_samples),
    }
    data.update(request.param)
    return pd.DataFrame.from_dict(data)


@pytest.fixture
def input_schema(request):
    """
    Provides a phoneix Schema fixture with a base set of columns and an optional configurable set of additional columns
    :param request: params contains the additional columns to add to the Schema
    :return: Schema
    """
    schema = {
        "feature_column_names": ["feature"],
        "prediction_score_column_name": "predicted_score",
    }
    schema.update(request.param)
    return Schema(**schema)
