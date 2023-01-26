import pytest

from phoenix.server.api.types import Dataset
from phoenix.core.datasets import Schema, Dataset as CoreDataset

from pandas import DataFrame, Timestamp


@pytest.fixture
def core_dataset():
    input_df = DataFrame(
        {
            "prediction_label": ["apple", "orange", "grape"],
            "timestamp": [
                Timestamp(year=2023, month=1, day=1, hour=2, second=30),
                Timestamp(year=2023, month=1, day=5, hour=4, second=25),
                Timestamp(year=2023, month=1, day=10, hour=6, second=20),
            ]
        }
    )

    input_schema = Schema(
        prediction_label_column_name="prediction_label",
        timestamp_column_name="timestamp",
    )
    return CoreDataset(dataframe=input_df, schema=input_schema)


def test_dataset_serialization(core_dataset):
    converted_gql_dataset = Dataset.to_gql_dataset(core_dataset)

    expected_dataset = core_dataset
    assert converted_gql_dataset.start_time == expected_dataset.start_time
    assert converted_gql_dataset.end_time == expected_dataset.end_time
