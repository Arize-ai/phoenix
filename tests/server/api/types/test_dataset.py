from typing import Any, Callable, Dict, List, Optional

import pytest
from pandas import DataFrame, Series, Timestamp
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
    converted_gql_dataset = to_gql_dataset(input_dataset)

    expected_dataset = input_dataset
    assert converted_gql_dataset.start_time == expected_dataset.start_time
    assert converted_gql_dataset.end_time == expected_dataset.end_time


class TestDatasetEvents:
    #         pytest.param(
    #             "primaryDataset",
    #             ["0:DatasetType.PRIMARY", "2:DatasetType.PRIMARY"],
    #             [
    #                 DimensionInput(name="feature0", type=DimensionType.feature),
    #                 DimensionInput(name="tag0", type=DimensionType.tag),
    #             ],
    #             ["feature0", "tag0"],
    #             id="test_primary_dataset_with_input_dimensions",
    #         ),
    #         pytest.param(
    #             "primaryDataset",
    #             [],
    #             None,
    #             [],
    #             id="test_empty_ids_returns_empty_list",
    #         ),
    #         pytest.param(
    #             "referenceDataset",
    #             ["1:DatasetType.REFERENCE", "2:DatasetType.REFERENCE"],
    #             [],
    #             [],
    #             id="test_empty_dimension_inputs_return_events_with_empty_dimensions",
    #         ),
    #     ],
    # )

    def test_no_input_dimensions_correctly_selects_event_ids_and_all_features_and_tags(
        self,
        primary_dataset: InternalDataset,
        reference_dataset: InternalDataset,
        context_factory: ContextFactory,
        strawberry_schema: StrawberrySchema,
    ) -> None:
        query = """
            fragment EventDetails on Event {
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
            query Events($primaryEventIds: [ID!]!, $referenceEventIds: [ID!]!) {
                model {
                    primaryDataset {
                        events(eventIds: $primaryEventIds) {
                            ...EventDetails
                        }
                    }
                    referenceDataset {
                        events(eventIds: $referenceEventIds) {
                            ...EventDetails
                        }
                    }
                }
            }
        """
        primary_event_ids = ["0:DatasetType.PRIMARY", "2:DatasetType.PRIMARY"]
        reference_event_ids = ["1:DatasetType.REFERENCE", "2:DatasetType.REFERENCE"]
        result = strawberry_schema.execute_sync(
            query=query,
            context_value=context_factory(primary_dataset, reference_dataset),
            variable_values={
                "primaryEventIds": primary_event_ids,
                "referenceEventIds": reference_event_ids,
            },
        )
        expected_dimension_names = ["feature0", "feature1", "tag0"]
        assert result.errors is None
        assert result.data is not None
        for dataset_split, dataset, event_ids in [
            ("primaryDataset", primary_dataset, primary_event_ids),
            ("referenceDataset", reference_dataset, reference_event_ids),
        ]:
            events = result.data["model"][dataset_split]["events"]
            dataframe = dataset.dataframe
            assert len(events) == len(event_ids)
            for event_id, event in zip(event_ids, events):
                row_id = int(str(event_id).split(":")[0])
                dataframe_row = dataframe.iloc[row_id]
                self._assert_event_contains_expected_dimensions(
                    event=event, expected_dimension_names=expected_dimension_names
                )
                self._assert_event_values_match_dataframe_row_values(
                    event=event,
                    dataframe_row=dataframe_row,
                    expected_dimension_names=expected_dimension_names,
                )
                self._assert_event_metadata_values_match_dataframe_row_values(
                    event_metadata=event["eventMetadata"], dataframe_row=dataframe_row
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

    @staticmethod
    def _assert_event_contains_expected_dimensions(
        event: Dict[str, Any], expected_dimension_names: List[str]
    ) -> None:
        assert [
            dim_with_value["dimension"]["name"] for dim_with_value in event["dimensions"]
        ] == expected_dimension_names

    @staticmethod
    def _assert_event_values_match_dataframe_row_values(
        event: Dict[str, Any], dataframe_row: "Series[Any]", expected_dimension_names: List[str]
    ) -> None:
        event_dimension_values = [dim_with_value["value"] for dim_with_value in event["dimensions"]]
        dataframe_row_values = list(map(str, dataframe_row[expected_dimension_names].tolist()))
        assert event_dimension_values == dataframe_row_values

    @staticmethod
    def _assert_event_metadata_values_match_dataframe_row_values(
        event_metadata: Dict[str, Any], dataframe_row: "Series[Any]"
    ) -> None:
        assert event_metadata.get("predictionLabel") == dataframe_row.get("prediction_label")
        assert event_metadata.get("predictionScore") == dataframe_row.get("prediction_score")
        assert event_metadata.get("actualLabel") == dataframe_row.get("actual_label")
        assert event_metadata.get("actualScore") == dataframe_row.get("actual_score")
