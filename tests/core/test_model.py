import pytest
from pandas import DataFrame, Timestamp
import numpy as np
import pandas as pd

from phoenix.datasets import Dataset, EmbeddingColumnNames
from phoenix.datasets import Schema
from phoenix.core.model import Model


@pytest.fixture
def input_dataset():
    num_records = 3
    embedding_dimensions = 7

    input_dataframe = DataFrame(
        {
            "prediction_label": ["apple", "orange", "grape"],
            "timestamp": [
                Timestamp(year=2023, month=1, day=1, hour=2, second=30),
                Timestamp(year=2023, month=1, day=5, hour=4, second=25),
                Timestamp(year=2023, month=1, day=10, hour=6, second=20),
            ],
            "embedding_vector0": [
                np.zeros(embedding_dimensions) for _ in range(num_records)
            ],
            "link_to_data0": [f"some-link{index}" for index in range(num_records)],
            "raw_data_column0": [f"some-text{index}" for index in range(num_records)],
        }
    )

    input_schema = Schema(
        prediction_label_column_name="prediction_label",
        timestamp_column_name="timestamp",
        embedding_feature_column_names={
            "embedding_feature0": EmbeddingColumnNames(
                vector_column_name="embedding_vector0",
                link_to_data_column_name="link_to_data0",
                raw_data_column_name="raw_data_column0",
            ),
        },
    )
    return Dataset(dataframe=input_dataframe, schema=input_schema)


@pytest.fixture
def second_dataset():
    num_records = 3
    embedding_dimensions = 5

    input_dataframe = DataFrame(
        {
            "prediction_label": ["apple", "orange", "grape", "lime", "lemon"],
            "prediction_id": [str(x) for x in range(num_records)],
            "timestamp": [pd.Timestamp.now() for x in range(num_records)],
            "embedding_vector0": [
                np.zeros(embedding_dimensions) for _ in range(num_records)
            ],
            "link_to_data0": [f"some-link{index}" for index in range(num_records)],
            "raw_data_column0": [f"some-text{index}" for index in range(num_records)],
        }
    )

    input_dataframe["embedding_vector0"].iloc[1] = np.zeros(embedding_dimensions + 1)
    input_schema = Schema(
        prediction_labelcolumn_name="prediction_label",
        timestamp_column_name="timestamp",
        embedding_feature_column_names={
            "embedding_feature0": EmbeddingColumnNames(
                vector_column_name="embedding_vector0",
                link_to_data_column_name="link_to_data0",
                raw_data_column_name="raw_data_column0",
            ),
        },
    )
    return Dataset(dataframe=input_dataframe, schema=input_schema)


def test_dataset_serialization(input_dataset, second_dataset):
    embedding_dimensions = Model._get_embedding_dimensions(input_dataset, second_dataset)
    assert len(embedding_dimensions) == 1


def test_dataset_serialization(input_dataset):
    embedding_dimensions = Model._get_embedding_dimensions(input_dataset, input_dataset)
    assert len(embedding_dimensions) == 1
