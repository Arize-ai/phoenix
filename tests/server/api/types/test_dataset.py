from typing import Callable, Literal, Optional

import pytest
from pandas import DataFrame, Timestamp
from strawberry.schema import Schema as StrawberrySchema
from typing_extensions import TypeAlias

from phoenix.datasets import Dataset as InternalDataset
from phoenix.datasets import Schema
from phoenix.server.api.context import Context
from phoenix.server.api.types.Dataset import to_gql_dataset

ContextFactory: TypeAlias = Callable[[InternalDataset, Optional[InternalDataset]], Context]


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
    converted_gql_dataset = to_gql_dataset(input_dataset, type="primary")

    expected_dataset = input_dataset
    assert converted_gql_dataset.start_time == expected_dataset.start_time
    assert converted_gql_dataset.end_time == expected_dataset.end_time


class TestDatasetEvents:
    def test_no_input_dimensions_correctly_selects_event_ids_and_all_features_and_tags(
        self,
        primary_dataset: InternalDataset,
        reference_dataset: InternalDataset,
        context_factory: ContextFactory,
        strawberry_schema: StrawberrySchema,
    ) -> None:
        result = strawberry_schema.execute_sync(
            query=self._get_events_query("primaryDataset"),
            context_value=context_factory(primary_dataset, reference_dataset),
            variable_values={
                "eventIds": ["0:DatasetType.PRIMARY"],
            },
        )
        assert result.errors is None
        assert result.data is not None
        events = result.data["model"]["primaryDataset"]["events"]
        assert len(events) == 1
        assert [
            dim_with_value["dimension"]["name"] for dim_with_value in events[0]["dimensions"]
        ] == ["feature0", "feature1", "tag0"]
        assert [dim_with_value["value"] for dim_with_value in events[0]["dimensions"]] == [
            "9.0",
            "blue",
            "tag0",
        ]
        assert events[0]["eventMetadata"] == {
            "predictionLabel": "class0",
            "predictionScore": 1.0,
            "actualLabel": "class4",
            "actualScore": 4.0,
        }

    def test_input_dimensions_correctly_selects_event_ids_and_dimensions(
        self,
        primary_dataset: InternalDataset,
        reference_dataset: InternalDataset,
        context_factory: ContextFactory,
        strawberry_schema: StrawberrySchema,
    ) -> None:
        result = strawberry_schema.execute_sync(
            query=self._get_events_query("referenceDataset"),
            context_value=context_factory(primary_dataset, reference_dataset),
            variable_values={
                "eventIds": ["1:DatasetType.REFERENCE", "2:DatasetType.REFERENCE"],
                "dimensions": [
                    {"name": "tag0", "type": "tag"},
                ],
            },
        )

        assert result.errors is None
        assert result.data is not None
        events = result.data["model"]["referenceDataset"]["events"]
        assert len(events) == 2
        assert [
            dim_with_value["dimension"]["name"] for dim_with_value in events[0]["dimensions"]
        ] == ["tag0"]
        assert [dim_with_value["value"] for dim_with_value in events[0]["dimensions"]] == [
            "tag1",
        ]
        assert events[0]["eventMetadata"] == {
            "predictionLabel": "class1",
            "predictionScore": None,
            "actualLabel": None,
            "actualScore": 3.0,
        }
        assert [
            dim_with_value["dimension"]["name"] for dim_with_value in events[1]["dimensions"]
        ] == ["tag0"]
        assert [dim_with_value["value"] for dim_with_value in events[1]["dimensions"]] == [
            "tag2",
        ]
        assert events[1]["eventMetadata"] == {
            "predictionLabel": "class2",
            "predictionScore": None,
            "actualLabel": None,
            "actualScore": 2.0,
        }

    def test_empty_event_ids_returns_empty_list(
        self,
        primary_dataset: InternalDataset,
        reference_dataset: InternalDataset,
        context_factory: ContextFactory,
        strawberry_schema: StrawberrySchema,
    ) -> None:
        result = strawberry_schema.execute_sync(
            query=self._get_events_query("primaryDataset"),
            context_value=context_factory(primary_dataset, reference_dataset),
            variable_values={
                "eventIds": [],
            },
        )
        assert result.errors is None
        assert result.data is not None
        assert len(result.data["model"]["primaryDataset"]["events"]) == 0

    def test_empty_input_dimensions_returns_events_with_empty_dimensions(
        self,
        primary_dataset: InternalDataset,
        reference_dataset: InternalDataset,
        context_factory: ContextFactory,
        strawberry_schema: StrawberrySchema,
    ) -> None:
        result = strawberry_schema.execute_sync(
            query=self._get_events_query("referenceDataset"),
            context_value=context_factory(primary_dataset, reference_dataset),
            variable_values={
                "eventIds": ["1:DatasetType.REFERENCE"],
                "dimensions": [],
            },
        )

        assert result.errors is None
        assert result.data is not None
        events = result.data["model"]["referenceDataset"]["events"]
        assert len(events) == 1
        assert len(events[0]["dimensions"]) == 0
        assert events[0]["eventMetadata"] == {
            "predictionLabel": "class1",
            "predictionScore": None,
            "actualLabel": None,
            "actualScore": 3.0,
        }

    def test_event_ids_from_incorrect_dataset_returns_error(
        self,
        primary_dataset: InternalDataset,
        reference_dataset: InternalDataset,
        context_factory: ContextFactory,
        strawberry_schema: StrawberrySchema,
    ) -> None:
        result = strawberry_schema.execute_sync(
            query=self._get_events_query("primaryDataset"),
            context_value=context_factory(primary_dataset, reference_dataset),
            variable_values={
                "eventIds": ["0:DatasetType.PRIMARY", "1:DatasetType.REFERENCE"],
            },
        )
        assert result.errors is not None
        assert len(result.errors) == 1
        assert "incorrect dataset" in str(result.errors[0])
        assert result.data is None

    @staticmethod
    def _get_events_query(dataset_split: Literal["primaryDataset", "referenceDataset"]) -> str:
        """
        Returns a formatted events query for the input dataset split.
        """
        return (
            """
            query Events($eventIds: [ID!]!, $dimensions: [DimensionInput!]) {
                model {
                    %s {
                        events(eventIds: $eventIds, dimensions: $dimensions) {
                            eventMetadata {
                                predictionLabel
                                predictionScore
                                actualLabel
                                actualScore
                            }
                            dimensions {
                                dimension {
                                    name
                                }
                                value
                            }
                        }
                    }
                }
            }
        """
            % dataset_split
        )

    @staticmethod
    @pytest.fixture
    def primary_dataset() -> InternalDataset:
        return InternalDataset(
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

    @staticmethod
    @pytest.fixture
    def reference_dataset() -> InternalDataset:
        return InternalDataset(
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
