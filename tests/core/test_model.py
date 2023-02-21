import numpy as np
import pandas as pd
import pytest
from pandas import DataFrame, Timestamp

from phoenix.core.model import Model
from phoenix.datasets import Dataset, EmbeddingColumnNames, Schema


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
            "embedding_vector0": [np.zeros(embedding_dimensions) for _ in range(num_records)],
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
            "prediction_label": ["apple", "orange", "grape"],
            "prediction_id": [str(x) for x in range(num_records)],
            "timestamp": [pd.Timestamp.now() for x in range(num_records)],
            "embedding_vector0": [np.zeros(embedding_dimensions) for _ in range(num_records)],
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


def test_invalid_model_primary_and_ref_embedding_size_mismatch(input_dataset, second_dataset):
    with pytest.raises(ValueError):
        _ = Model._get_embedding_dimensions(input_dataset, second_dataset)


def test_valid_model_primary_and_ref_embedding_size_åmismatch(input_dataset):
    embedding_dimensions = Model._get_embedding_dimensions(input_dataset, input_dataset)
    assert len(embedding_dimensions) == 1
