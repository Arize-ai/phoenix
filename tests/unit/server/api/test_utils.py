from datetime import datetime, timezone
from typing import Optional

import pytest
from freezegun import freeze_time

from phoenix.datetime_utils import is_timezone_aware
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.Granularity import Granularity
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.utils import get_parameters_for_simple_time_series


class TestGetParametersForSimpleTimeSeries:
    """Tests for get_parameters_for_simple_time_series function.

    This function calculates time series parameters based on time range and granularity.
    It returns a tuple of (stop_time, interval_seconds) where stop_time is rounded
    to the nearest minute and interval_seconds is calculated from granularity.
    """  # noqa: E501

    @pytest.mark.parametrize(
        "time_range, granularity, expected_interval_seconds, expected_stop_time",
        [
            pytest.param(
                TimeRange(
                    start=datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                    end=datetime(2023, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
                ),
                None,
                3600,  # Default hourly granularity
                datetime(2023, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
                id="No granularity - defaults to hourly",
            ),
            pytest.param(
                TimeRange(
                    start=datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                    end=datetime(2023, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
                ),
                Granularity(evaluation_window_minutes=17, sampling_interval_minutes=17),
                1020,  # 17 minutes * 60 seconds
                datetime(2023, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
                id="With granularity - 17 minute intervals",
            ),
            pytest.param(
                TimeRange(
                    start=datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                    end=datetime(2023, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
                ),
                Granularity(evaluation_window_minutes=61, sampling_interval_minutes=61),
                3660,  # 61 minutes * 60 seconds
                datetime(2023, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
                id="With granularity - 61 minute intervals",
            ),
            pytest.param(
                TimeRange(
                    start=None,
                    end=datetime(2023, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
                ),
                None,
                3600,  # Default hourly granularity
                datetime(2023, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
                id="Time range with end only",
            ),
            pytest.param(
                None,
                None,
                3600,  # Default hourly granularity
                datetime(2023, 1, 1, 12, 30, 0, tzinfo=timezone.utc),  # Current frozen time
                id="No time range and no granularity",
            ),
            pytest.param(
                TimeRange(
                    start=datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                    end=datetime(2023, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
                ),
                Granularity(evaluation_window_minutes=None, sampling_interval_minutes=23),
                1380,  # 23 minutes * 60 seconds
                datetime(2023, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
                id="Granularity with None evaluation_window_minutes",
            ),
            pytest.param(
                TimeRange(
                    start=datetime(
                        2023, 1, 1, 12, 0, 30, 500000, tzinfo=timezone.utc
                    ),  # With seconds and microseconds
                    end=datetime(2023, 1, 1, 13, 0, 45, 123456, tzinfo=timezone.utc),
                ),
                None,
                3600,  # Default hourly granularity
                datetime(2023, 1, 1, 13, 0, 0, tzinfo=timezone.utc),  # Rounded to minute
                id="Time range with seconds and microseconds - rounded to minute",
            ),
        ],
    )
    @freeze_time("2023-01-01 12:30:00", tz_offset=0)
    def test_get_parameters_for_simple_time_series(
        self,
        time_range: Optional[TimeRange],
        granularity: Optional[Granularity],
        expected_interval_seconds: int,
        expected_stop_time: datetime,
    ) -> None:
        """Test get_parameters_for_simple_time_series with various input combinations.

        Args:
            time_range: Optional time range with start/end times
            granularity: Optional granularity settings
            expected_interval_seconds: Expected interval in seconds
            expected_stop_time: Expected stop time (rounded to minute)
        """  # noqa: E501
        # Act
        stop_time, interval_seconds = get_parameters_for_simple_time_series(time_range, granularity)

        # Assert
        # Check that interval_seconds is calculated correctly
        assert (
            interval_seconds == expected_interval_seconds
        ), "interval_seconds should match expected value"

        # Check that stop_time is a proper datetime
        assert isinstance(stop_time, datetime)
        assert is_timezone_aware(stop_time), "stop_time should be timezone-aware"

        # Check that stop_time is rounded to the nearest minute
        assert stop_time.second == 0, "stop_time should have seconds set to 0"
        assert stop_time.microsecond == 0, "stop_time should have microseconds set to 0"

        # Check the specific stop_time value for each test case
        assert stop_time == expected_stop_time, "stop_time should match expected value"

    def test_get_parameters_for_simple_time_series_invalid_granularity(self) -> None:
        """Test that the function raises BadRequest when evaluation_window_minutes != sampling_interval_minutes.

        This tests the validation logic that ensures evaluation_window_minutes equals
        sampling_interval_minutes when both are provided.
        """  # noqa: E501
        # Arrange
        time_range = TimeRange(
            start=datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
            end=datetime(2023, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
        )
        granularity = Granularity(evaluation_window_minutes=13, sampling_interval_minutes=29)

        # Act & Assert
        with pytest.raises(BadRequest):
            get_parameters_for_simple_time_series(time_range, granularity)
