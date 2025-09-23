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
from phoenix.db.helpers import SupportedSQLDialect, date_trunc, get_dataset_example_revisions
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


class TestGetDatasetExampleRevisions:
    @pytest.fixture
    async def _test_data(
        self,
        db: DbSessionFactory,
    ) -> dict[str, int]:
        """Create test data for dataset example revisions tests."""
        async with db() as session:
            # Create datasets
            dataset1 = models.Dataset(name="test_dataset_1", description="Test Dataset 1")
            dataset2 = models.Dataset(name="test_dataset_2", description="Test Dataset 2")
            session.add_all([dataset1, dataset2])
            await session.flush()

            # Create dataset versions
            version1 = models.DatasetVersion(dataset_id=dataset1.id, description="Version 1")
            version2 = models.DatasetVersion(dataset_id=dataset1.id, description="Version 2")
            version3 = models.DatasetVersion(dataset_id=dataset1.id, description="Version 3")
            version_other = models.DatasetVersion(dataset_id=dataset2.id, description="Version 1")
            session.add_all([version1, version2, version3, version_other])
            await session.flush()

            # Create dataset examples
            example1 = models.DatasetExample(dataset_id=dataset1.id)
            example2 = models.DatasetExample(dataset_id=dataset1.id)
            example3 = models.DatasetExample(dataset_id=dataset1.id)
            example_other = models.DatasetExample(dataset_id=dataset2.id)
            session.add_all([example1, example2, example3, example_other])
            await session.flush()

            # Create dataset example revisions
            revisions = [
                # Example 1: Multiple revisions across versions
                models.DatasetExampleRevision(
                    dataset_example_id=example1.id,
                    dataset_version_id=version1.id,
                    input={"test": "v1"},
                    output={"result": "v1"},
                    metadata={},
                    revision_kind="CREATE",
                ),
                models.DatasetExampleRevision(
                    dataset_example_id=example1.id,
                    dataset_version_id=version2.id,
                    input={"test": "v2"},
                    output={"result": "v2"},
                    metadata={},
                    revision_kind="PATCH",
                ),
                models.DatasetExampleRevision(
                    dataset_example_id=example1.id,
                    dataset_version_id=version3.id,
                    input={"test": "v3"},
                    output={"result": "v3"},
                    metadata={},
                    revision_kind="PATCH",
                ),
                # Example 2: CREATE then DELETE
                models.DatasetExampleRevision(
                    dataset_example_id=example2.id,
                    dataset_version_id=version1.id,
                    input={"test": "create"},
                    output={"result": "create"},
                    metadata={},
                    revision_kind="CREATE",
                ),
                models.DatasetExampleRevision(
                    dataset_example_id=example2.id,
                    dataset_version_id=version2.id,
                    input={"test": "deleted"},
                    output={"result": "deleted"},
                    metadata={},
                    revision_kind="DELETE",
                ),
                # Example 3: Only in version 3
                models.DatasetExampleRevision(
                    dataset_example_id=example3.id,
                    dataset_version_id=version3.id,
                    input={"test": "new"},
                    output={"result": "new"},
                    metadata={},
                    revision_kind="CREATE",
                ),
                # Example in different dataset
                models.DatasetExampleRevision(
                    dataset_example_id=example_other.id,
                    dataset_version_id=version_other.id,
                    input={"test": "other"},
                    output={"result": "other"},
                    metadata={},
                    revision_kind="CREATE",
                ),
            ]
            session.add_all(revisions)
            await session.flush()

            # Return IDs for use in tests
            return {
                "dataset1_id": dataset1.id,
                "dataset2_id": dataset2.id,
                "version1_id": version1.id,
                "version2_id": version2.id,
                "version3_id": version3.id,
                "version_other_id": version_other.id,
                "example1_id": example1.id,
                "example2_id": example2.id,
                "example3_id": example3.id,
                "example_other_id": example_other.id,
                "revision1_1_id": revisions[0].id,
                "revision1_2_id": revisions[1].id,
                "revision1_3_id": revisions[2].id,
                "revision2_1_id": revisions[3].id,
                "revision2_2_id": revisions[4].id,  # DELETE
                "revision3_3_id": revisions[5].id,
                "revision_other_id": revisions[6].id,
            }

    async def test_get_latest_revisions_basic(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test getting latest revisions for a dataset version."""
        async with db() as session:
            # Test version 1 - should get example1 v1 and example2 v1
            query = get_dataset_example_revisions(_test_data["version1_id"])
            revisions = (await session.execute(query)).scalars().all()

            revision_ids = [r.id for r in revisions]
            example_ids = [r.dataset_example_id for r in revisions]

            # Should get 2 revisions
            assert len(revisions) == 2
            assert _test_data["revision1_1_id"] in revision_ids
            assert _test_data["revision2_1_id"] in revision_ids
            assert _test_data["example1_id"] in example_ids
            assert _test_data["example2_id"] in example_ids

    async def test_get_latest_revisions_with_updates(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test getting latest revisions when examples have multiple revisions."""
        async with db() as session:
            # Test version 2 - should get only example1 v2 (example2 is DELETEd)
            query = get_dataset_example_revisions(_test_data["version2_id"])
            revisions = (await session.execute(query)).scalars().all()

            revision_ids = [r.id for r in revisions]
            example_ids = [r.dataset_example_id for r in revisions]

            # Should get 1 revision: only example1's v2 revision
            assert len(revisions) == 1
            assert _test_data["revision1_2_id"] in revision_ids  # Latest for example1
            assert _test_data["example1_id"] in example_ids
            # example2 should NOT be included because its latest revision is DELETE
            assert _test_data["example2_id"] not in example_ids

    async def test_exclude_delete_revisions(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test that DELETE revisions are properly excluded."""
        async with db() as session:
            # Test version 2 - example2 has DELETE revision, should be excluded entirely
            query = get_dataset_example_revisions(_test_data["version2_id"])
            revisions = (await session.execute(query)).scalars().all()

            example_ids = [r.dataset_example_id for r in revisions]

            # example2 should NOT be included because its latest revision is DELETE
            assert (
                _test_data["example2_id"] not in example_ids
            )  # Should be excluded due to DELETE revision

    async def test_get_all_revisions_latest_version(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test getting revisions for the latest version includes all non-deleted examples."""
        async with db() as session:
            # Test version 3 - should get example1 v3 and example3 v3 (example2 remains deleted)
            query = get_dataset_example_revisions(_test_data["version3_id"])
            revisions = (await session.execute(query)).scalars().all()

            revision_ids = [r.id for r in revisions]
            example_ids = [r.dataset_example_id for r in revisions]

            # Should get 2 revisions (example2 remains deleted)
            assert len(revisions) == 2
            assert _test_data["revision1_3_id"] in revision_ids  # Latest for example1
            assert _test_data["revision3_3_id"] in revision_ids  # New example3
            assert _test_data["example1_id"] in example_ids
            assert _test_data["example3_id"] in example_ids
            # example2 should still NOT be included because it was deleted and not recreated
            assert _test_data["example2_id"] not in example_ids

    async def test_no_duplicate_dataset_example_ids(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test that no duplicate dataset_example_ids are returned."""
        async with db() as session:
            for version_id in [
                _test_data["version1_id"],
                _test_data["version2_id"],
                _test_data["version3_id"],
            ]:
                query = get_dataset_example_revisions(version_id)
                revisions = (await session.execute(query)).scalars().all()

                example_ids = [r.dataset_example_id for r in revisions]
                unique_example_ids = set(example_ids)

                # No duplicates
                assert len(example_ids) == len(unique_example_ids), (
                    f"Duplicate example IDs found for version {version_id}: {example_ids}"
                )

    async def test_cross_dataset_isolation(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test that results are isolated to the correct dataset."""
        async with db() as session:
            # Test other dataset version
            query = get_dataset_example_revisions(_test_data["version_other_id"])
            revisions = (await session.execute(query)).scalars().all()

            example_ids = [r.dataset_example_id for r in revisions]

            # Should only get the one example from dataset2
            assert len(revisions) == 1
            assert _test_data["example_other_id"] in example_ids

            # Should NOT contain any examples from dataset1
            dataset1_examples = [
                _test_data["example1_id"],
                _test_data["example2_id"],
                _test_data["example3_id"],
            ]
            for example_id in dataset1_examples:
                assert example_id not in example_ids

    async def test_empty_result_for_nonexistent_version(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test that query returns empty result for non-existent version."""
        async with db() as session:
            # Use a non-existent version ID
            query = get_dataset_example_revisions(99999)
            revisions = (await session.execute(query)).scalars().all()

            assert len(revisions) == 0
