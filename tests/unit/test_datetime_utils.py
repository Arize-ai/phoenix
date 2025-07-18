from datetime import datetime, timezone
from typing import List, Literal

import pytest

from phoenix.datetime_utils import get_timestamp_range, is_timezone_aware


class TestIsTimezoneAware:
    @pytest.mark.parametrize("t", [datetime.now(timezone.utc), datetime.now()])
    def test_is_timezone_aware(self, t: datetime) -> None:
        try:
            t < datetime.now(timezone.utc)
        except TypeError:
            assert not is_timezone_aware(t)
        else:
            assert is_timezone_aware(t)


class TestGetTimestampRange:
    @pytest.mark.parametrize(
        "start_time,end_time,stride,utc_offset_minutes,expected_count",
        [
            pytest.param(
                datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                datetime(2024, 1, 1, 12, 5, 0, tzinfo=timezone.utc),
                "minute",
                0,
                5,
                id="5_minutes",
            ),
            pytest.param(
                datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                datetime(2024, 1, 1, 15, 0, 0, tzinfo=timezone.utc),
                "hour",
                0,
                3,
                id="3_hours",
            ),
            pytest.param(
                datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                datetime(2024, 1, 4, 0, 0, 0, tzinfo=timezone.utc),
                "day",
                0,
                3,
                id="3_days",
            ),
            pytest.param(
                datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                datetime(2024, 1, 22, 0, 0, 0, tzinfo=timezone.utc),
                "week",
                0,
                3,
                id="3_weeks",
            ),
            pytest.param(
                datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                datetime(2024, 4, 1, 0, 0, 0, tzinfo=timezone.utc),
                "month",
                0,
                3,
                id="3_months",
            ),
            pytest.param(
                datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                "year",
                0,
                3,
                id="3_years",
            ),
        ],
    )
    def test_get_timestamp_range_basic(
        self,
        start_time: datetime,
        end_time: datetime,
        stride: Literal["minute", "hour", "day", "week", "month", "year"],
        utc_offset_minutes: int,
        expected_count: int,
    ) -> None:
        result = list(get_timestamp_range(start_time, end_time, stride, utc_offset_minutes))
        assert len(result) == expected_count
        assert all(isinstance(ts, datetime) for ts in result)
        assert all(ts.tzinfo == timezone.utc for ts in result)

    @pytest.mark.parametrize(
        "start_time,end_time,stride,utc_offset_minutes,expected_first",
        [
            pytest.param(
                datetime(2024, 1, 1, 12, 30, 45, tzinfo=timezone.utc),
                datetime(2024, 1, 1, 12, 35, 0, tzinfo=timezone.utc),
                "minute",
                0,
                datetime(2024, 1, 1, 12, 30, 0, tzinfo=timezone.utc),
                id="minute_rounding_down",
            ),
            pytest.param(
                datetime(2024, 1, 1, 12, 30, 45, tzinfo=timezone.utc),
                datetime(2024, 1, 1, 15, 0, 0, tzinfo=timezone.utc),
                "hour",
                0,
                datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                id="hour_rounding_down",
            ),
            pytest.param(
                datetime(2024, 1, 15, 12, 30, 45, tzinfo=timezone.utc),
                datetime(2024, 1, 20, 0, 0, 0, tzinfo=timezone.utc),
                "day",
                0,
                datetime(2024, 1, 15, 0, 0, 0, tzinfo=timezone.utc),
                id="day_rounding_down",
            ),
            pytest.param(
                datetime(2024, 1, 10, 12, 30, 45, tzinfo=timezone.utc),  # Wednesday
                datetime(2024, 1, 20, 0, 0, 0, tzinfo=timezone.utc),
                "week",
                0,
                datetime(2024, 1, 8, 0, 0, 0, tzinfo=timezone.utc),  # Monday
                id="week_rounding_down_to_monday",
            ),
            pytest.param(
                datetime(2024, 1, 15, 12, 30, 45, tzinfo=timezone.utc),
                datetime(2024, 3, 1, 0, 0, 0, tzinfo=timezone.utc),
                "month",
                0,
                datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                id="month_rounding_down",
            ),
            pytest.param(
                datetime(2024, 6, 15, 12, 30, 45, tzinfo=timezone.utc),
                datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                "year",
                0,
                datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                id="year_rounding_down",
            ),
        ],
    )
    def test_get_timestamp_range_rounding(
        self,
        start_time: datetime,
        end_time: datetime,
        stride: Literal["minute", "hour", "day", "week", "month", "year"],
        utc_offset_minutes: int,
        expected_first: datetime,
    ) -> None:
        result = list(get_timestamp_range(start_time, end_time, stride, utc_offset_minutes))
        assert len(result) > 0
        assert result[0] == expected_first

    @pytest.mark.parametrize(
        "start_time,end_time,stride,utc_offset_minutes,expected_timestamps",
        [
            pytest.param(
                datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                datetime(2024, 1, 1, 12, 3, 0, tzinfo=timezone.utc),
                "minute",
                0,
                [
                    datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                    datetime(2024, 1, 1, 12, 1, 0, tzinfo=timezone.utc),
                    datetime(2024, 1, 1, 12, 2, 0, tzinfo=timezone.utc),
                ],
                id="minute_sequence",
            ),
            pytest.param(
                datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                datetime(2024, 1, 1, 14, 0, 0, tzinfo=timezone.utc),
                "hour",
                0,
                [
                    datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                    datetime(2024, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
                ],
                id="hour_sequence",
            ),
            pytest.param(
                datetime(2024, 1, 29, 0, 0, 0, tzinfo=timezone.utc),
                datetime(2024, 3, 15, 0, 0, 0, tzinfo=timezone.utc),
                "month",
                0,
                [
                    datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                    datetime(2024, 2, 1, 0, 0, 0, tzinfo=timezone.utc),
                    datetime(2024, 3, 1, 0, 0, 0, tzinfo=timezone.utc),
                ],
                id="month_sequence_across_february",
            ),
            pytest.param(
                datetime(2023, 12, 15, 0, 0, 0, tzinfo=timezone.utc),
                datetime(2025, 2, 1, 0, 0, 0, tzinfo=timezone.utc),
                "year",
                0,
                [
                    datetime(2023, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                    datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                    datetime(2025, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                ],
                id="year_sequence_across_boundaries",
            ),
        ],
    )
    def test_get_timestamp_range_exact_sequence(
        self,
        start_time: datetime,
        end_time: datetime,
        stride: Literal["minute", "hour", "day", "week", "month", "year"],
        utc_offset_minutes: int,
        expected_timestamps: List[datetime],
    ) -> None:
        result = list(get_timestamp_range(start_time, end_time, stride, utc_offset_minutes))
        assert result == expected_timestamps

    @pytest.mark.parametrize(
        "start_time,end_time,stride,utc_offset_minutes",
        [
            pytest.param(
                datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                datetime(2024, 1, 1, 11, 0, 0, tzinfo=timezone.utc),
                "minute",
                0,
                id="end_before_start",
            ),
            pytest.param(
                datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                "minute",
                0,
                id="same_start_end",
            ),
        ],
    )
    def test_get_timestamp_range_empty_result(
        self,
        start_time: datetime,
        end_time: datetime,
        stride: Literal["minute", "hour", "day", "week", "month", "year"],
        utc_offset_minutes: int,
    ) -> None:
        result = list(get_timestamp_range(start_time, end_time, stride, utc_offset_minutes))
        assert result == []

    @pytest.mark.parametrize(
        "start_time,end_time,stride,utc_offset_minutes,expected_first",
        [
            pytest.param(
                datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                datetime(2024, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
                "minute",
                60,  # +1 hour offset
                datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),  # Should still be UTC output
                id="positive_utc_offset",
            ),
            pytest.param(
                datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                datetime(2024, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
                "minute",
                -120,  # -2 hours offset
                datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),  # Should still be UTC output
                id="negative_utc_offset",
            ),
        ],
    )
    def test_get_timestamp_range_utc_offset(
        self,
        start_time: datetime,
        end_time: datetime,
        stride: Literal["minute", "hour", "day", "week", "month", "year"],
        utc_offset_minutes: int,
        expected_first: datetime,
    ) -> None:
        result = list(get_timestamp_range(start_time, end_time, stride, utc_offset_minutes))
        assert len(result) > 0
        # Results should always be in UTC regardless of offset
        assert all(ts.tzinfo == timezone.utc for ts in result)
        assert result[0] == expected_first

    def test_get_timestamp_range_month_edge_cases(self) -> None:
        """Test month transitions including February and leap years"""
        # Test February to March in a leap year
        start_time = datetime(2024, 2, 15, 0, 0, 0, tzinfo=timezone.utc)  # 2024 is leap year
        end_time = datetime(2024, 4, 1, 0, 0, 0, tzinfo=timezone.utc)
        result = list(get_timestamp_range(start_time, end_time, "month", 0))

        expected = [
            datetime(2024, 2, 1, 0, 0, 0, tzinfo=timezone.utc),
            datetime(2024, 3, 1, 0, 0, 0, tzinfo=timezone.utc),
        ]
        assert result == expected

    def test_get_timestamp_range_week_edge_cases(self) -> None:
        """Test week transitions across month boundaries"""
        # Start on a Friday, should round down to Monday
        start_time = datetime(2024, 1, 5, 12, 0, 0, tzinfo=timezone.utc)  # Friday
        end_time = datetime(2024, 1, 15, 0, 0, 0, tzinfo=timezone.utc)
        result = list(get_timestamp_range(start_time, end_time, "week", 0))

        # Should start from Monday Jan 1, 2024
        assert result[0] == datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        assert result[1] == datetime(2024, 1, 8, 0, 0, 0, tzinfo=timezone.utc)

    def test_get_timestamp_range_iterator_behavior(self) -> None:
        """Test that the function returns an iterator that can be consumed multiple times"""
        start_time = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        end_time = datetime(2024, 1, 1, 12, 3, 0, tzinfo=timezone.utc)

        iterator = get_timestamp_range(start_time, end_time, "minute", 0)

        # First consumption
        result1 = list(iterator)
        assert len(result1) == 3

        # Second consumption should be empty (iterator exhausted)
        result2 = list(iterator)
        assert len(result2) == 0

        # Create new iterator for fresh consumption
        new_iterator = get_timestamp_range(start_time, end_time, "minute", 0)
        result3 = list(new_iterator)
        assert result3 == result1
