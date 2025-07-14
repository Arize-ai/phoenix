import itertools
from datetime import timedelta, timezone
from secrets import token_hex
from typing import Iterable, Literal, cast

import pandas as pd
import pytest
import sqlalchemy as sa
from faker import Faker
from sqlalchemy import func
from typing_extensions import assert_never

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
        for _ in range(10):
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
