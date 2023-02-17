from datetime import datetime
from typing import Any, Callable, List, Optional

import pytest
from pandas import DataFrame, Series, Timestamp
from strawberry.types.info import Info
from typing_extensions import TypeAlias

from phoenix.datasets import Dataset as InternalDataset
from phoenix.datasets import Schema
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.DimensionInput import DimensionInput
from phoenix.server.api.types.Dataset import Dataset, to_gql_dataset
from phoenix.server.api.types.DimensionType import DimensionType
from phoenix.server.api.types.Event import Event
from phoenix.server.api.types.EventMetadata import EventMetadata

InfoMockFactory: TypeAlias = Callable[
    [InternalDataset, Optional[InternalDataset]], Info[Context, None]
]


@pytest.fixture
def input_dataset() -> InternalDataset:
    input_df = DataFrame(
        {
            "prediction_label": ["apple", "orange", "grape"],
            "timestamp": [
                Timestamp(year=2023, month=1, day=1, hour=2, second=30),
                Timestamp(year=2023, month=1, day=5, hour=4, second=25),
                Timestamp(year=2023, month=1, day=10, hour=6, second=20),
            ],
        }
    )

    input_schema = Schema(
        prediction_label_column_name="prediction_label",
        timestamp_column_name="timestamp",
    )
    return InternalDataset(dataframe=input_df, schema=input_schema)


def test_dataset_serialization(input_dataset: InternalDataset) -> None:
    converted_gql_dataset = to_gql_dataset(input_dataset)

    expected_dataset = input_dataset
    assert converted_gql_dataset.start_time == expected_dataset.start_time
    assert converted_gql_dataset.end_time == expected_dataset.end_time


@pytest.mark.parametrize(
    "dataset_name,event_ids,dimensions,expected_dimension_names",
    [
        pytest.param(
            "primary",
            [0, 2],
            None,
            [
                "feature0",
                "feature1",
                "tag0",
            ],
            id="test_primary_dataset_with_no_input_dimensions",
        ),
        pytest.param(
            "reference",
            [0, 1, 2],
            None,
            [
                "feature0",
                "feature1",
                "tag0",
            ],
            id="test_reference_dataset_with_no_input_dimensions",
        ),
        pytest.param(
            "primary",
            [0, 2],
            [
                DimensionInput(name="feature0", type=DimensionType.feature),
                DimensionInput(name="tag0", type=DimensionType.tag),
            ],
            ["feature0", "tag0"],
            id="test_primary_dataset_with_input_dimensions",
        ),
        pytest.param(
            "primary",
            [],
            None,
            [],
            id="test_empty_ids_returns_empty_list",
        ),
        pytest.param(
            "reference",
            [1, 2],
            [],
            [],
            id="test_empty_dimension_inputs_return_events_with_empty_dimensions",
        ),
    ],
)
def test_dataset_events_correctly_selects_event_ids_and_input_dimensions(
    dataset_name: str,
    event_ids: List[int],
    dimensions: Optional[List[DimensionInput]],
    expected_dimension_names: List[str],
    info_mock_factory: InfoMockFactory,
) -> None:
    primary_dataset = InternalDataset(
        dataframe=DataFrame(
            {
                "prediction_id": ["primary_pred0", "primary_pred1", "primary_pred2"],
                "prediction_label": ["class0", "class1", "class2"],
                "prediction_score": [1.0, 2.0, 3.0],
                "actual_label": ["class4", "class1", "class 2"],
                "actual_score": [4.0, 3.0, 2.0],
                "feature0": [9.0, 8.0, 7.0],
                "feature1": ["blue", "red", "green"],
                "tag0": ["tag0", "tag1", "tag2"],
            }
        ),
        schema=Schema(
            prediction_id_column_name="prediction_id",
            prediction_label_column_name="prediction_label",
            prediction_score_column_name="prediction_score",
            actual_label_column_name="actual_label",
            actual_score_column_name="actual_score",
            feature_column_names=["feature0", "feature1"],
            tag_column_names=["tag0"],
        ),
        name="primary",
        persist_to_disc=False,
    )
    reference_dataset = InternalDataset(
        dataframe=DataFrame(
            {
                "prediction_id": ["reference_pred0", "reference_pred1", "reference_pred2"],
                "prediction_label": ["class0", "class1", "class2"],
                "actual_score": [4.0, 3.0, 2.0],
                "feature0": [9.0, 8.0, 7.0],
                "feature1": ["blue", "red", "green"],
                "tag0": ["tag0", "tag1", "tag2"],
            }
        ),
        schema=Schema(
            prediction_id_column_name="prediction_id",
            prediction_label_column_name="prediction_label",
            actual_score_column_name="actual_score",
            feature_column_names=["feature0", "feature1"],
            tag_column_names=["tag0"],
        ),
        name="reference",
        persist_to_disc=False,
    )
    events = Dataset(name=dataset_name, start_time=datetime.now(), end_time=datetime.now()).events(
        event_ids=event_ids,
        dimensions=dimensions,
        info=info_mock_factory(primary_dataset, reference_dataset),
    )
    dataframe = (
        primary_dataset.dataframe if dataset_name == "primary" else reference_dataset.dataframe
    )
    assert len(events) == len(event_ids)
    for event_id, event in zip(event_ids, events):
        dataframe_row = dataframe.iloc[event_id]
        _assert_event_contains_expected_dimensions(
            event=event, expected_dimension_names=expected_dimension_names
        )
        _assert_event_values_match_dataframe_row_values(
            event=event,
            dataframe_row=dataframe_row,
            expected_dimension_names=expected_dimension_names,
        )
        _assert_event_metadata_values_match_dataframe_row_values(
            event_metadata=event.eventMetadata, dataframe_row=dataframe_row
        )


def _assert_event_contains_expected_dimensions(
    event: Event, expected_dimension_names: List[str]
) -> None:
    assert [
        dim_with_value.dimension.name for dim_with_value in event.dimensions
    ] == expected_dimension_names


def _assert_event_values_match_dataframe_row_values(
    event: Event, dataframe_row: "Series[Any]", expected_dimension_names: List[str]
) -> None:
    event_dimension_values = [dim_with_value.value for dim_with_value in event.dimensions]
    dataframe_row_values = dataframe_row[expected_dimension_names].tolist()
    assert event_dimension_values == dataframe_row_values


def _assert_event_metadata_values_match_dataframe_row_values(
    event_metadata: EventMetadata, dataframe_row: "Series[Any]"
) -> None:
    for field in ["prediction_label", "prediction_score", "actual_label", "actual_score"]:
        actual_value = getattr(event_metadata, field, None)
        expected_value = dataframe_row.get(field)
        assert actual_value == expected_value
