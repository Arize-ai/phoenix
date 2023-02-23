import numpy as np
import pandas as pd
from pandas import DataFrame

from phoenix.datasets import errors as err
from phoenix.datasets.dataset import (
    EmbeddingColumnNames,
    Schema,
    validate_dataset_inputs,
)

_NUM_RECORDS = 5
_EMBEDDING_DIMENSION = 7


def test_embeddings_vector_length_mismatch():
    input_dataframe = DataFrame(
        {
            "prediction_id": [str(x) for x in range(_NUM_RECORDS)],
            "timestamp": [pd.Timestamp.now() for x in range(_NUM_RECORDS)],
            "embedding_vector0": [np.zeros(_EMBEDDING_DIMENSION) for _ in range(_NUM_RECORDS)],
            "link_to_data0": [f"some-link{index}" for index in range(_NUM_RECORDS)],
            "raw_data_column0": [f"some-text{index}" for index in range(_NUM_RECORDS)],
        }
    )
    input_dataframe["embedding_vector0"].iloc[0] = np.zeros(_EMBEDDING_DIMENSION + 1)
    input_schema = Schema(
        prediction_id_column_name="prediction_id",
        timestamp_column_name="timestamp",
        embedding_feature_column_names={
            "embedding_feature0": EmbeddingColumnNames(
                vector_column_name="embedding_vector0",
                link_to_data_column_name="link_to_data0",
                raw_data_column_name="raw_data_column0",
            ),
        },
    )

    errors = validate_dataset_inputs(
        dataframe=input_dataframe,
        schema=input_schema,
    )
    assert len(errors) == 1
    assert isinstance(errors[0], err.EmbeddingVectorSizeMismatch)


def test_invalid_embeddings_vector_length():
    input_dataframe = DataFrame(
        {
            "prediction_id": [str(x) for x in range(_NUM_RECORDS)],
            "timestamp": [pd.Timestamp.now() for x in range(_NUM_RECORDS)],
            "embedding_vector0": [np.zeros(1) for _ in range(_NUM_RECORDS)],
            "link_to_data0": [f"some-link{index}" for index in range(_NUM_RECORDS)],
            "raw_data_column0": [f"some-text{index}" for index in range(_NUM_RECORDS)],
        }
    )
    input_schema = Schema(
        prediction_id_column_name="prediction_id",
        timestamp_column_name="timestamp",
        embedding_feature_column_names={
            "embedding_feature0": EmbeddingColumnNames(
                vector_column_name="embedding_vector0",
                link_to_data_column_name="link_to_data0",
                raw_data_column_name="raw_data_column0",
            ),
        },
    )

    errors = validate_dataset_inputs(
        dataframe=input_dataframe,
        schema=input_schema,
    )
    assert len(errors) == 1
    assert isinstance(errors[0], err.InvalidEmbeddingVectorSize)


def test_embeddings_vector_invalid_type():
    input_dataframe = DataFrame(
        {
            "prediction_id": [str(x) for x in range(_NUM_RECORDS)],
            "timestamp": [pd.Timestamp.now() for x in range(_NUM_RECORDS)],
            "embedding_vector0": "this is a string but must be a list, pd.Series or np.array type",
            "link_to_data1": [f"some-link{index}" for index in range(_NUM_RECORDS)],
            "raw_data_column1": [f"some-text{index}" for index in range(_NUM_RECORDS)],
            "embedding_vector1": [
                np.array(["abba" for _ in range(_EMBEDDING_DIMENSION)], dtype=object)
                for _ in range(_NUM_RECORDS)
            ],
            "link_to_data0": [f"some-link{index}" for index in range(_NUM_RECORDS)],
            "raw_data_column0": [f"some-text{index}" for index in range(_NUM_RECORDS)],
        }
    )
    input_schema = Schema(
        prediction_id_column_name="prediction_id",
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

    errors = validate_dataset_inputs(
        dataframe=input_dataframe,
        schema=input_schema,
    )
    assert len(errors) == 2
    assert isinstance(errors[0], err.InvalidEmbeddingVectorDataType)
    assert isinstance(errors[1], err.InvalidEmbeddingVectorValuesDataType)
