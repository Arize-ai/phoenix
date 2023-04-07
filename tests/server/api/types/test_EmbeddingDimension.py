from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

import numpy as np
import pytest
import pytz
from numpy.testing import assert_almost_equal
from pandas import DataFrame, Series, Timestamp
from phoenix.datasets import Dataset, EmbeddingColumnNames, Schema
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.Granularity import Granularity
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.EmbeddingDimension import EmbeddingDimension
from phoenix.server.api.types.VectorDriftMetricEnum import VectorDriftMetric
from strawberry.types.info import Info
from typing_extensions import TypeAlias

InfoMockFactory: TypeAlias = Callable[[Dataset, Optional[Dataset]], Info[Context, None]]

UTC = timezone(offset=timedelta(hours=0))


class TestDriftMetricTimeSeries:
    def test_no_reference_dataset_returns_empty_time_series(
        self, info_mock_factory: InfoMockFactory
    ) -> None:
        primary_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([3.0, 4.0]),
                    np.array([4.0, 5.0]),
                    np.array([2.0, 3.0]),
                ],
                "timestamp": [
                    datetime(year=2000, month=1, day=1, hour=1, minute=0),
                    datetime(year=2000, month=1, day=1, hour=1, minute=1),
                    datetime(year=2000, month=1, day=1, hour=1, minute=3),
                ],
            }
        )
        schema = Schema(
            timestamp_column_name="timestamp",
            embedding_feature_column_names={
                "embedding_feature": EmbeddingColumnNames(vector_column_name="embedding_vector")
            },
        )
        primary_dataset = Dataset(
            dataframe=primary_dataframe,
            schema=schema,
        )
        drift_time_series = EmbeddingDimension(
            name="embedding_feature", id_attr=0
        ).drift_time_series(
            metric=VectorDriftMetric.euclideanDistance,
            time_range=TimeRange(
                start=datetime(year=2000, month=1, day=1), end=datetime(year=2000, month=1, day=2)
            ),
            info=info_mock_factory(primary_dataset, None),
            granularity=Granularity(
                evaluation_window_minutes=1440,
                sampling_interval_minutes=1440,
            ),
        )
        assert len(drift_time_series.data) == 0

    @pytest.mark.parametrize(
        "query_time_range",
        [
            pytest.param(
                TimeRange(
                    start=datetime(year=2000, month=1, day=2),
                    end=datetime(year=2000, month=1, day=2),
                ),
                id="time_range_start_equals_time_range_end",
            ),
            pytest.param(
                TimeRange(
                    start=datetime(year=2000, month=1, day=2),
                    end=datetime(year=2000, month=1, day=1),
                ),
                id="time_range_start_later_than_time_range_end",
            ),
        ],
    )
    def test_invalid_time_range_returns_empty_time_series(
        self, query_time_range: TimeRange, info_mock_factory: InfoMockFactory
    ) -> None:
        primary_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([3.0, 4.0]),
                ],
                "timestamp": [
                    datetime(year=2000, month=1, day=1, hour=1, minute=0),
                ],
            }
        )
        reference_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([3.0, 4.0]),
                ],
                "timestamp": [
                    datetime(year=2000, month=1, day=1, hour=1, minute=0),
                ],
            }
        )
        schema = Schema(
            timestamp_column_name="timestamp",
            embedding_feature_column_names={
                "embedding_feature": EmbeddingColumnNames(vector_column_name="embedding_vector")
            },
        )
        primary_dataset = Dataset(
            dataframe=primary_dataframe,
            schema=schema,
        )
        reference_dataset = Dataset(
            dataframe=reference_dataframe,
            schema=schema,
        )
        distance = EmbeddingDimension(name="embedding_feature", id_attr=0).drift_time_series(
            metric=VectorDriftMetric.euclideanDistance,
            time_range=query_time_range,
            info=info_mock_factory(primary_dataset, reference_dataset),
            granularity=Granularity(
                evaluation_window_minutes=11519,
                sampling_interval_minutes=11519,
            ),
        )
        assert len(distance.data) == 0

    def test_evaluation_window_correctly_filters_records(
        self, info_mock_factory: InfoMockFactory
    ) -> None:
        primary_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([0.0, 0.0]),
                    6 * np.array([3.0, 4.0]),
                    np.array([0.0, 0.0]),
                ],
                "timestamp": Series(
                    [
                        Timestamp(year=2000, month=1, day=2),
                        Timestamp(year=2000, month=1, day=3),
                        Timestamp(year=2000, month=1, day=4),
                    ]
                ).dt.tz_localize(pytz.utc),
            }
        )
        # reference embeddings with mean vector at (0, 0)
        reference_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([0.0, 0.0]),
                    np.array([1.0, 1.0]),
                    np.array([-1.0, -1.0]),
                ],
                "timestamp": Series(
                    [
                        Timestamp(year=1999, month=1, day=1, hour=1, minute=0),
                        Timestamp(year=1999, month=1, day=1, hour=1, minute=1),
                        Timestamp(year=1999, month=1, day=1, hour=1, minute=3),
                    ]
                ).dt.tz_localize(pytz.utc),
            }
        )
        schema = Schema(
            timestamp_column_name="timestamp",
            embedding_feature_column_names={
                "embedding_feature": EmbeddingColumnNames(vector_column_name="embedding_vector")
            },
        )
        primary_dataset = Dataset(
            dataframe=primary_dataframe,
            schema=schema,
        )
        reference_dataset = Dataset(
            dataframe=reference_dataframe,
            schema=schema,
        )
        drift_time_series = EmbeddingDimension(
            name="embedding_feature", id_attr=0
        ).drift_time_series(
            metric=VectorDriftMetric.euclideanDistance,
            time_range=TimeRange(
                start=datetime(year=2000, month=1, day=1, tzinfo=UTC),
                end=datetime(year=2000, month=1, day=8, tzinfo=UTC),
            ),
            info=info_mock_factory(primary_dataset, reference_dataset),
            granularity=Granularity(
                evaluation_window_minutes=4320,
                sampling_interval_minutes=60,
            ),
        )
        actual_distances = np.array(
            [
                value if (value := data_point.value) is not None else np.nan
                for data_point in drift_time_series.data
            ]
        )
        actual_timestamps = [data_point.timestamp for data_point in drift_time_series.data]
        DAILY_HOURS = 24
        expected_distances = np.array(
            ([np.nan] * DAILY_HOURS)
            + ([0] * DAILY_HOURS)
            + ([15] * DAILY_HOURS)
            + ([10] * DAILY_HOURS)
            + ([15] * DAILY_HOURS)
            + ([0] * DAILY_HOURS)
            + ([np.nan] * DAILY_HOURS)
        )
        assert_almost_equal(
            actual=actual_distances,
            desired=expected_distances,
        )
        assert actual_timestamps[0] == Timestamp(year=2000, month=1, day=1, hour=1, tzinfo=pytz.utc)
        assert actual_timestamps[-1] == Timestamp(year=2000, month=1, day=8, tzinfo=pytz.utc)
        for index in range(len(actual_timestamps) - 1):
            assert actual_timestamps[index + 1] - actual_timestamps[index] == timedelta(hours=1)

    def test_left_time_range_boundary_included_right_time_range_boundary_excluded(
        self, info_mock_factory: InfoMockFactory
    ) -> None:
        primary_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([0.0, 0.0]),
                    np.array([1000000.0, 1000000.0]),
                ],
                "timestamp": Series(
                    [
                        Timestamp(year=2000, month=1, day=1, hour=1, minute=45),
                        Timestamp(year=2000, month=1, day=1, hour=3),
                    ]
                ).dt.tz_localize(pytz.utc),
            }
        )
        # reference embeddings with mean vector at (0, 0)
        reference_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([0.0, 0.0]),
                    np.array([1.0, 1.0]),
                    np.array([-1.0, -1.0]),
                ],
                "timestamp": Series(
                    [
                        Timestamp(year=1999, month=1, day=1, hour=1, minute=0),
                        Timestamp(year=1999, month=1, day=1, hour=1, minute=1),
                        Timestamp(year=1999, month=1, day=1, hour=1, minute=3),
                    ]
                ).dt.tz_localize(pytz.utc),
            }
        )
        schema = Schema(
            timestamp_column_name="timestamp",
            embedding_feature_column_names={
                "embedding_feature": EmbeddingColumnNames(vector_column_name="embedding_vector")
            },
        )
        primary_dataset = Dataset(
            dataframe=primary_dataframe,
            schema=schema,
        )
        reference_dataset = Dataset(
            dataframe=reference_dataframe,
            schema=schema,
        )
        drift_time_series = EmbeddingDimension(
            name="embedding_feature", id_attr=0
        ).drift_time_series(
            metric=VectorDriftMetric.euclideanDistance,
            time_range=TimeRange(
                start=datetime(year=2000, month=1, day=1, hour=1, tzinfo=UTC),
                end=datetime(year=2000, month=1, day=1, hour=2, tzinfo=UTC),
            ),
            info=info_mock_factory(primary_dataset, reference_dataset),
            granularity=Granularity(
                evaluation_window_minutes=60,
                sampling_interval_minutes=60,
            ),
        )
        actual_distances = np.array(
            [
                value if (value := data_point.value) is not None else np.nan
                for data_point in drift_time_series.data
            ]
        )
        actual_timestamps = [data_point.timestamp for data_point in drift_time_series.data]
        expected_distances = np.array([0.0])
        assert_almost_equal(
            actual=actual_distances,
            desired=expected_distances,
        )
        assert actual_timestamps == [Timestamp(year=2000, month=1, day=1, hour=2, tzinfo=pytz.utc)]


class TestDriftMetric:
    def test_no_reference_dataset_returns_none(self, info_mock_factory: InfoMockFactory) -> None:
        primary_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([3.0, 4.0]),
                    np.array([4.0, 5.0]),
                    np.array([2.0, 3.0]),
                ],
                "timestamp": [
                    datetime(year=2000, month=1, day=1, hour=1, minute=0),
                    datetime(year=2000, month=1, day=1, hour=1, minute=1),
                    datetime(year=2000, month=1, day=1, hour=1, minute=3),
                ],
            }
        )
        schema = Schema(
            timestamp_column_name="timestamp",
            embedding_feature_column_names={
                "embedding_feature": EmbeddingColumnNames(vector_column_name="embedding_vector")
            },
        )
        primary_dataset = Dataset(
            dataframe=primary_dataframe,
            schema=schema,
        )
        distance = EmbeddingDimension(name="embedding_feature", id_attr=0).drift_metric(
            metric=VectorDriftMetric.euclideanDistance,
            time_range=TimeRange(
                start=datetime(year=2000, month=1, day=1), end=datetime(year=2000, month=1, day=2)
            ),
            info=info_mock_factory(primary_dataset, None),
        )
        assert distance is None

    @pytest.mark.parametrize(
        "query_time_range",
        [
            pytest.param(
                TimeRange(
                    start=datetime(year=2000, month=1, day=2),
                    end=datetime(year=2000, month=1, day=2),
                ),
                id="time_range_start_equals_time_range_end",
            ),
            pytest.param(
                TimeRange(
                    start=datetime(year=2000, month=1, day=2),
                    end=datetime(year=2000, month=1, day=1),
                ),
                id="time_range_start_later_than_time_range_end",
            ),
        ],
    )
    def test_invalid_time_range_returns_none(
        self, query_time_range: TimeRange, info_mock_factory: InfoMockFactory
    ) -> None:
        primary_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([3.0, 4.0]),
                ],
                "timestamp": [
                    Timestamp(year=2000, month=1, day=1, hour=1, minute=0, tzinfo=pytz.utc),
                ],
            }
        )
        reference_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([3.0, 4.0]),
                ],
                "timestamp": [
                    Timestamp(year=2000, month=1, day=1, hour=1, minute=0, tzinfo=pytz.utc),
                ],
            }
        )
        schema = Schema(
            timestamp_column_name="timestamp",
            embedding_feature_column_names={
                "embedding_feature": EmbeddingColumnNames(vector_column_name="embedding_vector")
            },
        )
        primary_dataset = Dataset(
            dataframe=primary_dataframe,
            schema=schema,
        )
        reference_dataset = Dataset(
            dataframe=reference_dataframe,
            schema=schema,
        )
        distance = EmbeddingDimension(name="embedding_feature", id_attr=0).drift_metric(
            metric=VectorDriftMetric.euclideanDistance,
            time_range=query_time_range,
            info=info_mock_factory(primary_dataset, reference_dataset),
        )
        assert distance is None

    def test_includes_left_and_excludes_right_time_range_boundaries(
        self, info_mock_factory: InfoMockFactory
    ) -> None:
        # primary embeddings inside time range have mean vector at (3, 4)
        primary_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([1000000.0, 1000000.0]),
                    np.array([3.0, 4.0]),
                    np.array([4.0, 5.0]),
                    np.array([2.0, 3.0]),
                    np.array([1000000.0, 1000000.0]),
                ],
                "timestamp": Series(
                    [
                        Timestamp(year=2000, month=1, day=1, hour=0, minute=59),
                        Timestamp(year=2000, month=1, day=1, hour=1, minute=0),
                        Timestamp(year=2000, month=1, day=1, hour=1, minute=30),
                        Timestamp(
                            year=2000,
                            month=1,
                            day=1,
                            hour=1,
                            minute=59,
                            second=59,
                        ),
                        Timestamp(year=2000, month=1, day=1, hour=2, minute=0),
                    ]
                ).dt.tz_localize(pytz.utc),
            }
        )
        # reference embeddings with mean vector at (0, 0)
        reference_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([0.0, 0.0]),
                    np.array([1.0, 1.0]),
                    np.array([-1.0, -1.0]),
                ],
                "timestamp": Series(
                    [
                        Timestamp(year=1999, month=1, day=1, hour=1, minute=0),
                        Timestamp(year=1999, month=1, day=1, hour=1, minute=1),
                        Timestamp(year=1999, month=1, day=1, hour=1, minute=3),
                    ]
                ).dt.tz_localize(pytz.utc),
            }
        )
        schema = Schema(
            timestamp_column_name="timestamp",
            embedding_feature_column_names={
                "embedding_feature": EmbeddingColumnNames(vector_column_name="embedding_vector")
            },
        )
        primary_dataset = Dataset(dataframe=primary_dataframe, schema=schema)
        reference_dataset = Dataset(dataframe=reference_dataframe, schema=schema)
        distance = EmbeddingDimension(name="embedding_feature", id_attr=0).drift_metric(
            metric=VectorDriftMetric.euclideanDistance,
            time_range=TimeRange(
                start=datetime(year=2000, month=1, day=1, hour=1, minute=0, tzinfo=UTC),
                end=datetime(year=2000, month=1, day=1, hour=2, minute=0, tzinfo=UTC),
            ),
            info=info_mock_factory(
                primary_dataset,
                reference_dataset,
            ),
        )
        assert_almost_equal(actual=distance, desired=5.0)

    def test_no_primary_embeddings_in_time_range_returns_none(
        self, info_mock_factory: InfoMockFactory
    ) -> None:
        primary_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([3.0, 4.0]),
                    np.array([4.0, 5.0]),
                    np.array([2.0, 3.0]),
                ],
                "timestamp": Series(
                    [
                        datetime(year=2000, month=1, day=1),
                        datetime(year=2000, month=1, day=2),
                        datetime(year=2000, month=1, day=3),
                    ]
                ).dt.tz_localize(pytz.utc),
            }
        )
        # reference embeddings with mean vector at (0, 0)
        reference_dataframe = DataFrame(
            {
                "embedding_vector": [
                    np.array([0.0, 0.0]),
                    np.array([1.0, 1.0]),
                    np.array([-1.0, -1.0]),
                ],
                "timestamp": Series(
                    [
                        datetime(year=1999, month=1, day=1, hour=1, minute=0),
                        datetime(year=1999, month=1, day=1, hour=1, minute=1),
                        datetime(year=1999, month=1, day=1, hour=1, minute=3),
                    ]
                ).dt.tz_localize(pytz.utc),
            }
        )
        schema = Schema(
            timestamp_column_name="timestamp",
            embedding_feature_column_names={
                "embedding_feature": EmbeddingColumnNames(vector_column_name="embedding_vector")
            },
        )
        primary_dataset = Dataset(dataframe=primary_dataframe, schema=schema)
        reference_dataset = Dataset(dataframe=reference_dataframe, schema=schema)
        distance = EmbeddingDimension(name="embedding_feature", id_attr=0).drift_metric(
            metric=VectorDriftMetric.euclideanDistance,
            time_range=TimeRange(
                start=datetime(year=2000, month=1, day=4, tzinfo=UTC),
                end=datetime(year=2000, month=1, day=10, tzinfo=UTC),
            ),
            info=info_mock_factory(
                primary_dataset,
                reference_dataset,
            ),
        )
        assert distance is None
