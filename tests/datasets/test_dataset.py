"""
Test dataset
"""

import random
from functools import partial

import numpy as np
import pandas as pd
import pytest
from numpy.testing import assert_array_almost_equal
from pytest_lazyfixture import lazy_fixture

from phoenix.datasets.dataset import Dataset, EmbeddingColumnNames, Schema


@pytest.fixture
def random_seed():
    np.random.seed(0)
    random.seed(0)


@pytest.fixture
def include_embeddings(request):
    return request.param


@pytest.fixture
def expected_df(include_embeddings, random_seed):
    num_samples = 9
    embedding_dimension = 15
    data = {
        "feature0": [random.random() for _ in range(num_samples)],
        "feature1": [random.random() for _ in range(num_samples)],
        "predicted_score": [random.random() for _ in range(num_samples)],
    }
    if include_embeddings:
        data["embeddings"] = [np.random.rand(embedding_dimension) for _ in range(num_samples)]
    return pd.DataFrame.from_dict(data)


@pytest.fixture
def csv_path(expected_df, tmp_path):
    path = tmp_path / "data.csv"
    expected_df.to_csv(path)
    return path


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
            Dataset.from_csv,
            lazy_fixture("csv_path"),
        ),
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
            Dataset.from_csv,
            lazy_fixture("csv_path"),
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
        "test_dataset_from_csv_correctly_loads_data_with_embeddings",
        "test_dataset_from_parquet_with_pyarrow_engine_correctly_loads_data_with_embeddings",
        "test_dataset_from_parquet_with_fastparquet_engine_correctly_loads_data_with_embeddings",
        "test_dataset_from_csv_correctly_loads_data_without_embeddings",
        "test_dataset_from_parquet_with_pyarrow_engine_correctly_loads_data_without_embeddings",
        "test_dataset_from_parquet_with_fastparquet_engine_correctly_loads_data_without_embeddings",
    ],
)
def test_dataset_initialization_class_methods_correctly_load_data_with_and_without_embeddings(
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
        if column_name == "embeddings":
            assert_embedding_columns_almost_equal(actual_column, expected_column)
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
