import numpy as np
import pandas as pd
import pytest
from pandas import DataFrame, Timestamp

from phoenix.core.embedding_dimension import EmbeddingDimension
from phoenix.core.model import _get_embedding_dimensions
from phoenix.inferences.inferences import Inferences
from phoenix.inferences.schema import EmbeddingColumnNames, Schema


@pytest.fixture
def inferences_with_large_embedding_vector() -> Inferences:
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
            "embedding_vector1": [np.zeros(embedding_dimensions + 1) for _ in range(num_records)],
            "link_to_data1": [f"some-link{index}" for index in range(num_records)],
            "raw_data_column1": [f"some-text{index}" for index in range(num_records)],
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
            "embedding_feature1": EmbeddingColumnNames(
                vector_column_name="embedding_vector1",
                link_to_data_column_name="link_to_data1",
                raw_data_column_name="raw_data_column1",
            ),
        },
    )
    return Inferences(dataframe=input_dataframe, schema=input_schema)


@pytest.fixture
def inferences_with_embedding_vector() -> Inferences:
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
            "embedding_vector1": [np.zeros(embedding_dimensions) for _ in range(num_records)],
            "link_to_data1": [f"some-link{index}" for index in range(num_records)],
            "raw_data_column1": [f"some-text{index}" for index in range(num_records)],
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
            "embedding_feature1": EmbeddingColumnNames(
                vector_column_name="embedding_vector1",
                link_to_data_column_name="link_to_data1",
                raw_data_column_name="raw_data_column1",
            ),
        },
    )
    return Inferences(dataframe=input_dataframe, schema=input_schema)


def test_invalid_model_embeddings_primary_and_ref_embedding_size_mismatch(
    inferences_with_embedding_vector: Inferences,
    inferences_with_large_embedding_vector: Inferences,
) -> None:
    with pytest.raises(ValueError):
        _ = _get_embedding_dimensions(
            inferences_with_embedding_vector, inferences_with_large_embedding_vector
        )


def test_valid_model_embeddings(inferences_with_embedding_vector: Inferences) -> None:
    embedding_dimensions = _get_embedding_dimensions(
        inferences_with_embedding_vector, inferences_with_embedding_vector
    )
    assert len(embedding_dimensions) == 2
    assert embedding_dimensions == [
        EmbeddingDimension(name="embedding_feature0"),
        EmbeddingDimension(name="embedding_feature1"),
    ]


def test_valid_model_embeddings_one_inferences_missing_embeddings_feature(
    inferences_with_embedding_vector: Inferences,
) -> None:
    num_records = 3
    input_dataframe = DataFrame(
        {
            "prediction_label": ["apple", "orange", "grape"],
            "prediction_id": [str(x) for x in range(num_records)],
            "timestamp": [pd.Timestamp.now() for x in range(num_records)],
        }
    )

    input_schema = Schema(
        prediction_label_column_name="prediction_label",
        timestamp_column_name="timestamp",
    )
    inferences_with_missing_embedding_vector = Inferences(
        dataframe=input_dataframe, schema=input_schema
    )

    embedding_dimensions = _get_embedding_dimensions(
        inferences_with_embedding_vector, inferences_with_missing_embedding_vector
    )
    assert len(embedding_dimensions) == 2
    assert embedding_dimensions == [
        EmbeddingDimension(name="embedding_feature0"),
        EmbeddingDimension(name="embedding_feature1"),
    ]


def test_valid_model_with_nan_embeddings(
    inferences_with_embedding_vector: Inferences,
) -> None:
    inferences_with_embedding_vector.dataframe["embedding_vector0"] = np.nan
    embedding_dimensions = _get_embedding_dimensions(
        inferences_with_embedding_vector,
        inferences_with_embedding_vector,
    )
    assert len(embedding_dimensions) == 2
    assert embedding_dimensions == [
        EmbeddingDimension(name="embedding_feature0"),
        EmbeddingDimension(name="embedding_feature1"),
    ]
