import itertools
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Iterable, Literal, cast

import pandas as pd
import pytest
import sqlalchemy as sa
from faker import Faker
from sqlalchemy import func
from typing_extensions import assert_never

from phoenix.datetime_utils import normalize_datetime
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, date_trunc
from phoenix.server.types import DbSessionFactory

fake = Faker()


class TestDateTrunc:
    @pytest.fixture
    async def _projects(
        self,
        db: DbSessionFactory,
    ) -> list[models.Project]:
        projects = []
        for _ in range(1000):
            created_at = fake.date_time_between(
                start_date="-2y",
                tzinfo=timezone.utc,
            )
            project = models.Project(name=token_hex(8), created_at=created_at)
            projects.append(project)
        async with db() as session:
            session.add_all(projects)
        return projects

    @staticmethod
    def _count_rows(
        df: pd.DataFrame,
        field: Literal["minute", "hour", "day", "week", "month", "year"],
        utc_offset_minutes: int,
    ) -> pd.DataFrame:
        offset_tz = timezone(timedelta(minutes=utc_offset_minutes))
        t = df.loc[:, "timestamp"].dt.tz_convert(offset_tz)
        if field == "minute":
            t = t.dt.floor("T")
        elif field == "hour":
            t = t.dt.floor("H")
        elif field == "day":
            t = t.dt.floor("D")
        elif field == "week":
            t = t.dt.to_period("W").dt.start_time.dt.tz_localize(offset_tz)
        elif field == "month":
            t = t.dt.to_period("M").dt.start_time.dt.tz_localize(offset_tz)
        elif field == "year":
            t = t.dt.to_period("Y").dt.start_time.dt.tz_localize(offset_tz)
        else:
            assert_never(field)
        t = t.dt.tz_convert(timezone.utc)
        return df.groupby(t).size().reset_index(name="count")

    async def test_group_by(
        self,
        db: DbSessionFactory,
        _projects: list[models.Project],
    ) -> None:
        df = pd.DataFrame({"timestamp": [p.created_at for p in _projects]}).sort_values("timestamp")
        for field, utc_offset_minutes in cast(
            Iterable[tuple[Literal["minute", "hour", "day", "week", "month", "year"], int]],
            itertools.product(
                ["minute", "hour", "day", "week", "month", "year"],
                [-720, -60, -45, -30, -15, 0, 15, 30, 45, 60, 720],
            ),
        ):
            # Calculate expected buckets using pandas (same logic as SQL function)
            expected_summary = self._count_rows(df, field, utc_offset_minutes)

            # Generate SQL expressions and execute query
            start = date_trunc(
                dialect=db.dialect,
                field=field,
                source=models.Project.created_at,
                utc_offset_minutes=utc_offset_minutes,
            )

            stmt = sa.select(start, func.count(models.Project.id)).group_by(start).order_by(start)

            async with db() as session:
                rows = (await session.execute(stmt)).all()

            actual_summary = pd.DataFrame(rows, columns=["timestamp", "count"])

            if db.dialect is SupportedSQLDialect.SQLITE:
                # SQLite returns timestamps as strings, convert to datetime
                actual_summary["timestamp"] = pd.to_datetime(
                    actual_summary["timestamp"]
                ).dt.tz_localize(timezone.utc)

            # Verify SQL results match pandas calculation
            try:
                pd.testing.assert_frame_equal(actual_summary, expected_summary, check_dtype=False)
            except AssertionError:
                test_desc = (
                    f"Failed for field={field}, utc_offset_minutes={utc_offset_minutes}, "
                    f"dialect={db.dialect}"
                )
                raise AssertionError(f"Failed {test_desc}")

    @pytest.mark.parametrize(
        "timestamp, expected, field, utc_offset_minutes",
        [
            # Test minute truncation
            pytest.param(
                "2024-01-15T12:34:56+00:00",
                "2024-01-15T12:34:00+00:00",
                "minute",
                0,
                id="minute_no_offset",
            ),
            pytest.param(
                "2024-01-15T12:34:56+00:00",
                "2024-01-15T12:34:00+00:00",
                "minute",
                60,  # UTC+1
                id="minute_plus_1_hour",
            ),
            pytest.param(
                "2024-01-15T12:34:56+00:00",
                "2024-01-15T12:34:00+00:00",
                "minute",
                -300,  # UTC-5
                id="minute_minus_5_hours",
            ),
            # Test hour truncation
            pytest.param(
                "2024-01-15T12:34:56+00:00",
                "2024-01-15T12:00:00+00:00",
                "hour",
                0,
                id="hour_no_offset",
            ),
            pytest.param(
                "2024-01-15T12:34:56+00:00",
                "2024-01-15T12:30:00+00:00",
                "hour",
                90,  # UTC+1:30
                id="hour_plus_1_5_hours",
            ),
            pytest.param(
                "2024-01-15T12:34:56+00:00",
                "2024-01-15T12:00:00+00:00",
                "hour",
                -480,  # UTC-8
                id="hour_minus_8_hours",
            ),
            # Test day truncation
            pytest.param(
                "2024-01-15T12:34:56+00:00",
                "2024-01-15T00:00:00+00:00",
                "day",
                0,
                id="day_no_offset",
            ),
            pytest.param(
                "2024-01-15T12:34:56+00:00",
                "2024-01-14T22:00:00+00:00",
                "day",
                120,  # UTC+2
                id="day_plus_2_hours",
            ),
            pytest.param(
                "2024-01-15T12:34:56+00:00",
                "2024-01-15T10:00:00+00:00",
                "day",
                -600,  # UTC-10
                id="day_minus_10_hours",
            ),
            pytest.param(
                "2024-01-15T02:34:56+00:00",
                "2024-01-14T03:00:00+00:00",
                "day",
                -180,  # UTC-3
                id="day_cross_boundary_minus_3_hours",
            ),
            # Test week truncation (Monday start)
            pytest.param(
                "2024-01-01T00:00:00+00:00",  # Monday
                "2024-01-01T00:00:00+00:00",
                "week",
                0,
                id="week_monday_no_offset",
            ),
            pytest.param(
                "2024-01-03T12:34:56+00:00",  # Wednesday
                "2024-01-01T00:00:00+00:00",  # Previous Monday
                "week",
                0,
                id="week_wednesday_no_offset",
            ),
            pytest.param(
                "2024-01-07T23:59:59+00:00",  # Sunday
                "2024-01-01T00:00:00+00:00",  # Previous Monday
                "week",
                0,
                id="week_sunday_no_offset",
            ),
            pytest.param(
                "2024-01-03T12:34:56+00:00",  # Wednesday
                "2023-12-31T20:00:00+00:00",
                "week",
                240,  # UTC+4
                id="week_wednesday_plus_4_hours",
            ),
            # Test month truncation
            pytest.param(
                "2024-01-15T12:34:56+00:00",
                "2024-01-01T00:00:00+00:00",
                "month",
                0,
                id="month_no_offset",
            ),
            pytest.param(
                "2024-02-29T12:34:56+00:00",  # Leap year
                "2024-02-01T00:00:00+00:00",
                "month",
                0,
                id="month_leap_year_february",
            ),
            pytest.param(
                "2024-12-31T23:59:59+00:00",
                "2024-12-01T00:00:00+00:00",
                "month",
                0,
                id="month_december_end",
            ),
            pytest.param(
                "2024-01-15T12:34:56+00:00",
                "2024-01-01T07:00:00+00:00",
                "month",
                -420,  # UTC-7
                id="month_minus_7_hours",
            ),
            pytest.param(
                "2024-02-01T02:34:56+00:00",
                "2024-01-01T03:00:00+00:00",
                "month",
                -180,  # UTC-3
                id="month_cross_boundary_minus_3_hours",
            ),
            # Test year truncation
            pytest.param(
                "2024-06-15T12:34:56+00:00",
                "2024-01-01T00:00:00+00:00",
                "year",
                0,
                id="year_no_offset",
            ),
            pytest.param(
                "2024-12-31T23:59:59+00:00",
                "2024-01-01T00:00:00+00:00",
                "year",
                0,
                id="year_december_end",
            ),
            pytest.param(
                "2024-06-15T12:34:56+00:00",
                "2023-12-31T18:00:00+00:00",
                "year",
                360,  # UTC+6
                id="year_plus_6_hours",
            ),
            pytest.param(
                "2024-01-01T02:34:56+00:00",
                "2023-01-01T05:00:00+00:00",
                "year",
                -300,  # UTC-5
                id="year_cross_boundary_minus_5_hours",
            ),
            # Test edge cases with large offsets
            pytest.param(
                "2024-01-15T12:34:56+00:00",
                "2024-01-15T12:00:00+00:00",
                "hour",
                720,  # UTC+12
                id="hour_plus_12_hours_extreme",
            ),
            pytest.param(
                "2024-01-15T12:34:56+00:00",
                "2024-01-15T12:00:00+00:00",
                "hour",
                -720,  # UTC-12
                id="hour_minus_12_hours_extreme",
            ),
            # Test specific time zone scenarios
            pytest.param(
                "2024-03-10T07:30:00+00:00",  # DST transition day
                "2024-03-09T08:00:00+00:00",
                "day",
                -480,  # PST (UTC-8)
                id="day_dst_transition_pst",
            ),
            pytest.param(
                "2024-11-03T06:30:00+00:00",  # DST transition day
                "2024-11-03T05:00:00+00:00",
                "day",
                -300,  # EST (UTC-5)
                id="day_dst_transition_est",
            ),
        ],
    )
    async def test_select_date_trunc(
        self,
        db: DbSessionFactory,
        timestamp: str,
        expected: str,
        field: Literal["minute", "hour", "day", "week", "month", "year"],
        utc_offset_minutes: int,
    ) -> None:
        # Convert string inputs to datetime objects
        timestamp_dt = datetime.fromisoformat(timestamp)
        expected_dt = datetime.fromisoformat(expected)

        stmt = sa.select(
            date_trunc(
                db.dialect,
                field,
                sa.text(":dt").bindparams(dt=timestamp_dt),
                utc_offset_minutes,
            )
        )

        async with db() as session:
            actual = await session.scalar(stmt)
        assert actual is not None
        if db.dialect is SupportedSQLDialect.SQLITE:
            # SQLite returns timestamps as strings, convert to datetime
            assert isinstance(actual, str)
            actual = normalize_datetime(datetime.fromisoformat(actual), timezone.utc)
        assert actual == expected_dt
