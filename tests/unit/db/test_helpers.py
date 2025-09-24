import itertools
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Iterable, Literal, Sequence, Union, cast

import pandas as pd
import pytest
import sqlalchemy as sa
from faker import Faker
from sqlalchemy import Select, func, literal, select
from sqlalchemy.sql import CompoundSelect
from typing_extensions import assert_never

from phoenix.datetime_utils import normalize_datetime
from phoenix.db import models
from phoenix.db.helpers import (
    SupportedSQLDialect,
    create_experiment_examples_snapshot_insert,
    date_trunc,
    get_dataset_example_revisions,
)
from phoenix.server.types import DbSessionFactory

fake = Faker()

# Test constants
NONEXISTENT_ID = 99999


def get_example_ids(revisions: Sequence[Any]) -> set[int]:
    """Extract dataset_example_id from a list of revisions."""
    return {r.dataset_example_id for r in revisions}


def create_id_subquery(*values: int) -> Union[Select[tuple[int]], CompoundSelect[tuple[int]]]:
    """Create a subquery with literal ID values for testing."""
    query = select(literal(values[0]))
    for value in values[1:]:
        query = query.union_all(select(literal(value)))  # type: ignore[assignment]
    return query


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
            revisions = (await session.scalars(query)).all()

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
            revisions = (await session.scalars(query)).all()

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
            revisions = (await session.scalars(query)).all()

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
            revisions = (await session.scalars(query)).all()

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
                revisions = (await session.scalars(query)).all()

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
            revisions = (await session.scalars(query)).all()

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
            revisions = (await session.scalars(query)).all()

            assert len(revisions) == 0

    async def test_get_revisions_with_example_ids_filter(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test filtering revisions by specific example IDs."""
        async with db() as session:
            # Create a query that returns specific example IDs
            example_ids_query = select(literal(_test_data["example1_id"]))

            query = get_dataset_example_revisions(
                _test_data["version2_id"], example_ids=example_ids_query
            )
            revisions = (await session.scalars(query)).all()

            # Should only get example1's latest revision
            assert len(revisions) == 1
            assert revisions[0].dataset_example_id == _test_data["example1_id"]
            assert revisions[0].id == _test_data["revision1_2_id"]  # Latest revision for example1

    async def test_get_revisions_with_multiple_example_ids(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test filtering with multiple example IDs."""
        async with db() as session:
            # Create a query that returns multiple example IDs
            example_ids_query = select(literal(_test_data["example1_id"])).union_all(
                select(literal(_test_data["example3_id"]))
            )

            query = get_dataset_example_revisions(
                _test_data["version3_id"], example_ids=example_ids_query
            )
            revisions = (await session.scalars(query)).all()

            # Should get revisions for both example1 and example3
            revision_example_ids = {r.dataset_example_id for r in revisions}
            assert len(revisions) == 2
            assert _test_data["example1_id"] in revision_example_ids
            assert _test_data["example3_id"] in revision_example_ids
            # Should not include example2 (it was deleted)
            assert _test_data["example2_id"] not in revision_example_ids

    async def test_get_revisions_example_ids_empty_subquery_returns_zero(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test that empty example_ids subquery returns zero results (strict filtering)."""
        async with db() as session:
            # Create a query that returns no example IDs
            example_ids_query = select(literal(99999)).where(literal(False))

            query = get_dataset_example_revisions(
                _test_data["version2_id"],
                example_ids=example_ids_query,
            )
            revisions = (await session.scalars(query)).all()

            # Empty subquery should return zero results (strict filtering)
            assert len(revisions) == 0

    async def test_get_revisions_example_ids_excludes_deletes(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test that example_ids filtering still excludes DELETE revisions."""
        async with db() as session:
            # Filter for example2, which has a DELETE revision as its latest
            example_ids_query = select(literal(_test_data["example2_id"]))

            query = get_dataset_example_revisions(
                _test_data["version2_id"], example_ids=example_ids_query
            )
            revisions = (await session.scalars(query)).all()

            # Should return empty since example2's latest revision is DELETE
            assert len(revisions) == 0

    async def test_get_revisions_example_ids_with_dataset_id_optimization(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test that example_ids works correctly with dataset_id optimization."""
        async with db() as session:
            # Use both dataset_id and example_ids parameters
            example_ids_query = select(literal(_test_data["example1_id"]))

            query = get_dataset_example_revisions(
                _test_data["version2_id"],
                dataset_id=_test_data["dataset1_id"],
                example_ids=example_ids_query,
            )
            revisions = (await session.scalars(query)).all()

            # Should get the same result as without dataset_id
            assert len(revisions) == 1
            assert revisions[0].dataset_example_id == _test_data["example1_id"]
            assert revisions[0].id == _test_data["revision1_2_id"]

    async def test_get_revisions_example_ids_cross_dataset_isolation(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test that example_ids filtering respects dataset boundaries."""
        async with db() as session:
            # Try to get example from dataset1 using dataset2's version
            example_ids_query = select(literal(_test_data["example1_id"]))

            query = get_dataset_example_revisions(
                _test_data["version_other_id"],  # This is for dataset2
                example_ids=example_ids_query,  # This example belongs to dataset1
            )
            revisions = (await session.scalars(query)).all()

            # Should return empty since example1 doesn't belong to dataset2
            assert len(revisions) == 0

    @pytest.fixture
    async def _test_data_with_splits(
        self,
        db: DbSessionFactory,
    ) -> dict[str, int]:
        """Create test data including dataset splits for split_names testing."""
        async with db() as session:
            # Create dataset
            dataset = models.Dataset(
                name="test_dataset_splits", description="Test Dataset with Splits"
            )
            session.add(dataset)
            await session.flush()

            # Create dataset versions
            version1 = models.DatasetVersion(dataset_id=dataset.id, description="Version 1")
            version2 = models.DatasetVersion(dataset_id=dataset.id, description="Version 2")
            session.add_all([version1, version2])
            await session.flush()

            # Create dataset examples
            example1 = models.DatasetExample(dataset_id=dataset.id)
            example2 = models.DatasetExample(dataset_id=dataset.id)
            example3 = models.DatasetExample(dataset_id=dataset.id)
            example4 = models.DatasetExample(dataset_id=dataset.id)  # For multi-split testing
            session.add_all([example1, example2, example3, example4])
            await session.flush()

            # Create dataset splits
            split_train = models.DatasetSplit(
                name="train", description="Training split", color="#FF0000", metadata_={}
            )
            split_test = models.DatasetSplit(
                name="test", description="Test split", color="#00FF00", metadata_={}
            )
            split_val = models.DatasetSplit(
                name="validation", description="Validation split", color="#0000FF", metadata_={}
            )
            session.add_all([split_train, split_test, split_val])
            await session.flush()

            # Assign examples to splits
            # example1 -> train only
            # example2 -> test only
            # example3 -> validation only
            # example4 -> both train and test (for multi-split testing)
            split_assignments = [
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_train.id, dataset_example_id=example1.id
                ),
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_test.id, dataset_example_id=example2.id
                ),
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_val.id, dataset_example_id=example3.id
                ),
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_train.id, dataset_example_id=example4.id
                ),
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_test.id, dataset_example_id=example4.id
                ),
            ]
            session.add_all(split_assignments)
            await session.flush()

            # Create dataset example revisions
            revisions = [
                # Example 1 (train split)
                models.DatasetExampleRevision(
                    dataset_example_id=example1.id,
                    dataset_version_id=version1.id,
                    input={"train": "example1"},
                    output={"result": "train1"},
                    metadata_={},
                    revision_kind="CREATE",
                ),
                # Example 2 (test split)
                models.DatasetExampleRevision(
                    dataset_example_id=example2.id,
                    dataset_version_id=version1.id,
                    input={"test": "example2"},
                    output={"result": "test2"},
                    metadata_={},
                    revision_kind="CREATE",
                ),
                # Example 2 - DELETE in version 2
                models.DatasetExampleRevision(
                    dataset_example_id=example2.id,
                    dataset_version_id=version2.id,
                    input={},
                    output={},
                    metadata_={},
                    revision_kind="DELETE",
                ),
                # Example 3 (validation split)
                models.DatasetExampleRevision(
                    dataset_example_id=example3.id,
                    dataset_version_id=version1.id,
                    input={"val": "example3"},
                    output={"result": "val3"},
                    metadata_={},
                    revision_kind="CREATE",
                ),
                # Example 4 (train + test splits)
                models.DatasetExampleRevision(
                    dataset_example_id=example4.id,
                    dataset_version_id=version1.id,
                    input={"multi": "example4"},
                    output={"result": "multi4"},
                    metadata_={},
                    revision_kind="CREATE",
                ),
            ]
            session.add_all(revisions)
            await session.flush()

            return {
                "dataset_id": dataset.id,
                "version1_id": version1.id,
                "version2_id": version2.id,
                "example1_id": example1.id,
                "example2_id": example2.id,
                "example3_id": example3.id,
                "example4_id": example4.id,
                "split_train_id": split_train.id,
                "split_test_id": split_test.id,
                "split_val_id": split_val.id,
                "revision1_id": revisions[0].id,
                "revision2_id": revisions[1].id,
                "revision2_delete_id": revisions[2].id,
                "revision3_id": revisions[3].id,
                "revision4_id": revisions[4].id,
            }

    async def test_get_revisions_with_single_split_name(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test filtering revisions by a single split name."""
        async with db() as session:
            # Test filtering by "train" split
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"], split_names=["train"]
            )
            revisions = (await session.scalars(query)).all()

            example_ids = get_example_ids(revisions)
            expected_ids = {
                _test_data_with_splits["example1_id"],
                _test_data_with_splits["example4_id"],
            }

            # Should get example1 (train only) and example4 (train + test)
            assert len(revisions) == 2
            assert example_ids == expected_ids

    async def test_get_revisions_with_multiple_split_names(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test filtering revisions by multiple split names."""
        async with db() as session:
            # Test filtering by both "train" and "test" splits
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"], split_names=["train", "test"]
            )
            revisions = (await session.scalars(query)).all()

            example_ids = {r.dataset_example_id for r in revisions}

            # Should get example1 (train), example2 (test), and example4 (both)
            # Should not get duplicates for example4 despite being in both splits
            assert len(revisions) == 3
            assert _test_data_with_splits["example1_id"] in example_ids
            assert _test_data_with_splits["example2_id"] in example_ids
            assert _test_data_with_splits["example4_id"] in example_ids
            # Should not get example3 (validation only)
            assert _test_data_with_splits["example3_id"] not in example_ids

    async def test_get_revisions_with_empty_split_names(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test that empty split_names returns zero results (strict filtering)."""
        async with db() as session:
            # Test with empty split_names list - should return zero results
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"], split_names=[]
            )
            revisions = (await session.scalars(query)).all()

            # Empty list should return zero results (strict filtering)
            assert len(revisions) == 0

    async def test_get_revisions_with_nonexistent_split_name(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test filtering by a split name that doesn't exist."""
        async with db() as session:
            # Test filtering by non-existent split
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"], split_names=["nonexistent"]
            )
            revisions = (await session.scalars(query)).all()

            # Should return no results
            assert len(revisions) == 0

    async def test_get_revisions_split_names_excludes_deletes(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test that split filtering still excludes DELETE revisions."""
        async with db() as session:
            # Test filtering by "test" split with version 2 (where example2 is deleted)
            query = get_dataset_example_revisions(
                _test_data_with_splits["version2_id"], split_names=["test"]
            )
            revisions = (await session.scalars(query)).all()

            example_ids = {r.dataset_example_id for r in revisions}

            # Should only get example4 (belongs to test split, not deleted)
            # Should NOT get example2 (belongs to test split but is deleted)
            assert len(revisions) == 1
            assert _test_data_with_splits["example4_id"] in example_ids
            assert _test_data_with_splits["example2_id"] not in example_ids

    async def test_get_revisions_split_names_with_example_ids(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test combining split_names with example_ids filtering."""
        async with db() as session:
            # Filter by both split_names and example_ids
            example_ids_query = create_id_subquery(
                _test_data_with_splits["example1_id"],
                _test_data_with_splits["example4_id"],
            )

            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                example_ids=example_ids_query,
                split_names=["train"],
            )
            revisions = (await session.scalars(query)).all()

            example_ids = {r.dataset_example_id for r in revisions}

            # Should get intersection: examples that are both in example_ids AND train split
            assert len(revisions) == 2
            assert _test_data_with_splits["example1_id"] in example_ids  # In both filters
            assert _test_data_with_splits["example4_id"] in example_ids  # In both filters

    async def test_get_revisions_split_names_with_dataset_id(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test combining split_names with dataset_id optimization."""
        async with db() as session:
            # Test with both dataset_id and split_names
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                dataset_id=_test_data_with_splits["dataset_id"],
                split_names=["validation"],
            )
            revisions = (await session.scalars(query)).all()

            example_ids = {r.dataset_example_id for r in revisions}

            # Should get only example3 (validation split)
            assert len(revisions) == 1
            assert _test_data_with_splits["example3_id"] in example_ids

    async def test_get_revisions_all_parameters_combined(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test using dataset_id, example_ids, and split_names all together."""
        async with db() as session:
            # Create example_ids query for examples 1 and 4
            example_ids_query = select(literal(_test_data_with_splits["example1_id"])).union_all(
                select(literal(_test_data_with_splits["example4_id"]))
            )

            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                dataset_id=_test_data_with_splits["dataset_id"],
                example_ids=example_ids_query,
                split_names=["train", "validation"],
            )
            revisions = (await session.scalars(query)).all()

            example_ids = {r.dataset_example_id for r in revisions}

            # Should get intersection of all filters:
            # - example_ids: [1, 4]
            # - split_names: examples in train OR validation
            # - Result: example1 (in example_ids AND train split)
            # - example4 is in example_ids and train split, so should be included too
            assert len(revisions) == 2
            assert _test_data_with_splits["example1_id"] in example_ids
            assert _test_data_with_splits["example4_id"] in example_ids

    async def test_get_revisions_with_single_split_id(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test filtering revisions by a single split ID (more efficient than split_names)."""
        async with db() as session:
            # Test filtering by train split ID
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                split_ids=[_test_data_with_splits["split_train_id"]],
            )
            revisions = (await session.scalars(query)).all()

            example_ids = {r.dataset_example_id for r in revisions}

            # Should get example1 (train only) and example4 (train + test)
            assert len(revisions) == 2
            assert _test_data_with_splits["example1_id"] in example_ids
            assert _test_data_with_splits["example4_id"] in example_ids
            # Should not get example2 (test only) or example3 (validation only)
            assert _test_data_with_splits["example2_id"] not in example_ids
            assert _test_data_with_splits["example3_id"] not in example_ids

    async def test_get_revisions_with_multiple_split_ids(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test filtering revisions by multiple split IDs."""
        async with db() as session:
            # Test filtering by both train and test split IDs
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                split_ids=[
                    _test_data_with_splits["split_train_id"],
                    _test_data_with_splits["split_test_id"],
                ],
            )
            revisions = (await session.scalars(query)).all()

            example_ids = {r.dataset_example_id for r in revisions}

            # Should get example1 (train), example2 (test), and example4 (both)
            # Should not get duplicates for example4 despite being in both splits
            assert len(revisions) == 3
            assert _test_data_with_splits["example1_id"] in example_ids
            assert _test_data_with_splits["example2_id"] in example_ids
            assert _test_data_with_splits["example4_id"] in example_ids
            # Should not get example3 (validation only)
            assert _test_data_with_splits["example3_id"] not in example_ids

    async def test_get_revisions_with_empty_split_ids(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test that empty split_ids returns zero results (strict filtering)."""
        async with db() as session:
            # Test with empty split_ids list - should return zero results
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"], split_ids=[]
            )
            revisions = (await session.scalars(query)).all()

            # Empty list should return zero results (strict filtering)
            assert len(revisions) == 0

    async def test_get_revisions_with_nonexistent_split_id(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test filtering by a split ID that doesn't exist."""
        async with db() as session:
            # Test filtering by non-existent split ID
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                split_ids=[NONEXISTENT_ID],
            )
            revisions = (await session.scalars(query)).all()

            # Should return no results
            assert len(revisions) == 0

    async def test_get_revisions_split_ids_excludes_deletes(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test that split ID filtering still excludes DELETE revisions."""
        async with db() as session:
            # Test filtering by test split ID with version 2 (where example2 is deleted)
            query = get_dataset_example_revisions(
                _test_data_with_splits["version2_id"],
                split_ids=[_test_data_with_splits["split_test_id"]],
            )
            revisions = (await session.scalars(query)).all()

            example_ids = {r.dataset_example_id for r in revisions}

            # Should only get example4 (belongs to test split, not deleted)
            # Should NOT get example2 (belongs to test split but is deleted)
            assert len(revisions) == 1
            assert _test_data_with_splits["example4_id"] in example_ids
            assert _test_data_with_splits["example2_id"] not in example_ids

    async def test_get_revisions_split_ids_with_example_ids(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test combining split_ids with example_ids filtering."""
        async with db() as session:
            # Filter by both split_ids and example_ids
            example_ids_query = create_id_subquery(
                _test_data_with_splits["example1_id"],
                _test_data_with_splits["example4_id"],
            )

            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                example_ids=example_ids_query,
                split_ids=[_test_data_with_splits["split_train_id"]],
            )
            revisions = (await session.scalars(query)).all()

            example_ids = {r.dataset_example_id for r in revisions}

            # Should get intersection: examples that are both in example_ids AND train split
            assert len(revisions) == 2
            assert _test_data_with_splits["example1_id"] in example_ids  # In both filters
            assert _test_data_with_splits["example4_id"] in example_ids  # In both filters

    async def test_get_revisions_split_ids_with_dataset_id(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test combining split_ids with dataset_id optimization."""
        async with db() as session:
            # Test with both dataset_id and split_ids
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                dataset_id=_test_data_with_splits["dataset_id"],
                split_ids=[_test_data_with_splits["split_val_id"]],
            )
            revisions = (await session.scalars(query)).all()

            example_ids = {r.dataset_example_id for r in revisions}

            # Should get only example3 (validation split)
            assert len(revisions) == 1
            assert _test_data_with_splits["example3_id"] in example_ids

    async def test_get_revisions_split_ids_with_subquery(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test using split_ids with a subquery instead of a list."""
        async with db() as session:
            # Create a subquery for split IDs (train and validation)
            split_ids_query = create_id_subquery(
                _test_data_with_splits["split_train_id"],
                _test_data_with_splits["split_val_id"],
            )

            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"], split_ids=split_ids_query
            )
            revisions = (await session.scalars(query)).all()

            example_ids = {r.dataset_example_id for r in revisions}

            # Should get example1 (train), example3 (validation), and example4 (train + test)
            assert len(revisions) == 3
            assert _test_data_with_splits["example1_id"] in example_ids  # train split
            assert _test_data_with_splits["example3_id"] in example_ids  # validation split
            assert _test_data_with_splits["example4_id"] in example_ids  # train split
            # Should not get example2 (test split only)
            assert _test_data_with_splits["example2_id"] not in example_ids

    async def test_get_revisions_split_ids_empty_subquery_returns_zero(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test that empty split_ids subquery returns zero results (strict filtering)."""
        async with db() as session:
            # Create a query that returns no split IDs
            split_ids_query = select(literal(99999)).where(literal(False))

            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                split_ids=split_ids_query,
            )
            revisions = (await session.scalars(query)).all()

            # Empty subquery should return zero results (strict filtering)
            assert len(revisions) == 0

    async def test_get_revisions_split_names_empty_subquery_returns_zero(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test that empty split_names subquery returns zero results (strict filtering)."""
        async with db() as session:
            # Create a query that returns no split names
            split_names_query = select(literal("nonexistent")).where(literal(False))

            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                split_names=split_names_query,
            )
            revisions = (await session.scalars(query)).all()

            # Empty subquery should return zero results (strict filtering)
            assert len(revisions) == 0

    async def test_get_revisions_empty_sequences_strict_filtering(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test that empty sequences return 0 results with strict filtering."""
        async with db() as session:
            # Test empty example_ids list
            query = get_dataset_example_revisions(
                _test_data["version2_id"],
                example_ids=[],
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

            # Test empty split_ids list
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                split_ids=[],
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

            # Test empty split_names list
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                split_names=[],
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

    async def test_get_revisions_empty_subqueries_strict_filtering(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test that empty subqueries return 0 results with strict filtering."""
        async with db() as session:
            # Test empty example_ids subquery
            example_ids_query = select(literal(99999)).where(literal(False))
            query = get_dataset_example_revisions(
                _test_data["version2_id"],
                example_ids=example_ids_query,
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

            # Test empty split_ids subquery
            split_ids_query = select(literal(99999)).where(literal(False))
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                split_ids=split_ids_query,
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

            # Test empty split_names subquery
            split_names_query = select(literal("nonexistent")).where(literal(False))
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                split_names=split_names_query,
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

    async def test_get_revisions_mixed_empty_filters_strict(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test combinations of empty filters with strict filtering."""
        async with db() as session:
            # Empty example_ids list + valid split_ids should return 0 results
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                example_ids=[],
                split_ids=[_test_data_with_splits["split_train_id"]],
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

            # Valid example_ids + empty split_ids should return 0 results
            query = get_dataset_example_revisions(
                _test_data_with_splits["version1_id"],
                example_ids=[_test_data_with_splits["example1_id"]],
                split_ids=[],
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

    async def test_get_revisions_split_ids_and_names_mutual_exclusion(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test that providing both split_ids and split_names raises an error."""
        async with db() as session:
            # Test that providing both split_ids and split_names raises ValueError
            with pytest.raises(
                ValueError,
                match="Cannot specify both split_ids and split_names - they are mutually exclusive",
            ):
                query = get_dataset_example_revisions(
                    _test_data_with_splits["version1_id"],
                    split_ids=[_test_data_with_splits["split_train_id"]],
                    split_names=["train"],
                )
                await session.execute(query)


class TestCreateExperimentExamplesSnapshotInsert:
    @pytest.fixture
    async def _test_data_with_splits(
        self,
        db: DbSessionFactory,
    ) -> dict[str, int]:
        """Create test data including dataset splits for snapshot tests."""
        async with db() as session:
            # Create datasets
            dataset1 = models.Dataset(name="test_dataset_1", description="Test Dataset 1")
            dataset2 = models.Dataset(name="test_dataset_2", description="Test Dataset 2")
            session.add_all([dataset1, dataset2])
            await session.flush()

            # Create dataset versions
            version1 = models.DatasetVersion(dataset_id=dataset1.id, description="Version 1")
            version2 = models.DatasetVersion(dataset_id=dataset1.id, description="Version 2")
            session.add_all([version1, version2])
            await session.flush()

            # Create dataset examples
            example1 = models.DatasetExample(dataset_id=dataset1.id)
            example2 = models.DatasetExample(dataset_id=dataset1.id)
            example3 = models.DatasetExample(dataset_id=dataset1.id)
            session.add_all([example1, example2, example3])
            await session.flush()

            # Create dataset splits
            split_train = models.DatasetSplit(
                name="train",
                description="Training split",
                color="#FF0000",
                metadata_={"split_type": "percentage", "split_value": 0.8},
            )
            split_test = models.DatasetSplit(
                name="test",
                description="Test split",
                color="#00FF00",
                metadata_={"split_type": "percentage", "split_value": 0.2},
            )
            session.add_all([split_train, split_test])
            await session.flush()

            # Assign examples to splits
            split_example1 = models.DatasetSplitDatasetExample(
                dataset_split_id=split_train.id, dataset_example_id=example1.id
            )
            split_example2 = models.DatasetSplitDatasetExample(
                dataset_split_id=split_train.id, dataset_example_id=example2.id
            )
            split_example3 = models.DatasetSplitDatasetExample(
                dataset_split_id=split_test.id, dataset_example_id=example3.id
            )
            session.add_all([split_example1, split_example2, split_example3])
            await session.flush()

            # Create dataset example revisions
            revisions = [
                # Example 1: CREATE in version 1
                models.DatasetExampleRevision(
                    dataset_example_id=example1.id,
                    dataset_version_id=version1.id,
                    input={"test": "example1_v1"},
                    output={"result": "example1_v1"},
                    metadata_={},
                    revision_kind="CREATE",
                ),
                # Example 1: PATCH in version 2
                models.DatasetExampleRevision(
                    dataset_example_id=example1.id,
                    dataset_version_id=version2.id,
                    input={"test": "example1_v2"},
                    output={"result": "example1_v2"},
                    metadata_={},
                    revision_kind="PATCH",
                ),
                # Example 2: CREATE in version 1
                models.DatasetExampleRevision(
                    dataset_example_id=example2.id,
                    dataset_version_id=version1.id,
                    input={"test": "example2_v1"},
                    output={"result": "example2_v1"},
                    metadata_={},
                    revision_kind="CREATE",
                ),
                # Example 2: DELETE in version 2
                models.DatasetExampleRevision(
                    dataset_example_id=example2.id,
                    dataset_version_id=version2.id,
                    input={"test": "deleted"},
                    output={"result": "deleted"},
                    metadata_={},
                    revision_kind="DELETE",
                ),
                # Example 3: CREATE in version 2
                models.DatasetExampleRevision(
                    dataset_example_id=example3.id,
                    dataset_version_id=version2.id,
                    input={"test": "example3_v2"},
                    output={"result": "example3_v2"},
                    metadata_={},
                    revision_kind="CREATE",
                ),
            ]
            session.add_all(revisions)
            await session.flush()

            # Create experiments
            # Experiment 1: Version 1, no splits
            experiment1 = models.Experiment(
                dataset_id=dataset1.id,
                dataset_version_id=version1.id,
                name="experiment_1",
                description="Experiment 1",
                repetitions=1,
                metadata_={},
            )

            # Experiment 2: Version 2, train split only
            experiment2 = models.Experiment(
                dataset_id=dataset1.id,
                dataset_version_id=version2.id,
                name="experiment_2",
                description="Experiment 2",
                repetitions=1,
                metadata_={},
            )

            # Experiment 3: Version 2, test split only
            experiment3 = models.Experiment(
                dataset_id=dataset1.id,
                dataset_version_id=version2.id,
                name="experiment_3",
                description="Experiment 3",
                repetitions=1,
                metadata_={},
            )

            session.add_all([experiment1, experiment2, experiment3])
            await session.flush()

            # Assign splits to experiments
            exp2_split = models.ExperimentDatasetSplit(
                experiment_id=experiment2.id, dataset_split_id=split_train.id
            )
            exp3_split = models.ExperimentDatasetSplit(
                experiment_id=experiment3.id, dataset_split_id=split_test.id
            )
            session.add_all([exp2_split, exp3_split])
            await session.flush()

            return {
                "dataset1_id": dataset1.id,
                "dataset2_id": dataset2.id,
                "version1_id": version1.id,
                "version2_id": version2.id,
                "example1_id": example1.id,
                "example2_id": example2.id,
                "example3_id": example3.id,
                "split_train_id": split_train.id,
                "split_test_id": split_test.id,
                "experiment1_id": experiment1.id,
                "experiment2_id": experiment2.id,
                "experiment3_id": experiment3.id,
                "revision1_1_id": revisions[0].id,
                "revision1_2_id": revisions[1].id,
                "revision2_1_id": revisions[2].id,
                "revision2_2_id": revisions[3].id,
                "revision3_2_id": revisions[4].id,
            }

    async def test_snapshot_insert_without_splits(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test creating snapshot INSERT for experiment without splits."""
        async with db() as session:
            # Get experiment 1 (no splits, version 1)
            experiment = await session.get(
                models.Experiment, _test_data_with_splits["experiment1_id"]
            )
            assert experiment is not None

            # Create the INSERT statement
            insert_stmt = create_experiment_examples_snapshot_insert(experiment)

            # Verify it's an INSERT statement
            assert hasattr(insert_stmt, "table")
            assert insert_stmt.table.name == "experiments_dataset_examples"

            # Execute the INSERT and verify results
            await session.execute(insert_stmt)
            await session.flush()

            # Query the junction table to verify results
            junction_records = (
                (
                    await session.execute(
                        sa.select(models.ExperimentDatasetExample).where(
                            models.ExperimentDatasetExample.experiment_id == experiment.id
                        )
                    )
                )
                .scalars()
                .all()
            )

            assert len(junction_records) == 2

            record_map = {r.dataset_example_id: r for r in junction_records}
            assert _test_data_with_splits["example1_id"] in record_map
            assert _test_data_with_splits["example2_id"] in record_map
            assert (
                record_map[_test_data_with_splits["example1_id"]].dataset_example_revision_id
                == _test_data_with_splits["revision1_1_id"]
            )
            assert (
                record_map[_test_data_with_splits["example2_id"]].dataset_example_revision_id
                == _test_data_with_splits["revision2_1_id"]
            )

    async def test_snapshot_insert_with_train_split(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test creating snapshot INSERT for experiment with train split only."""
        async with db() as session:
            # Get experiment 2 (train split, version 2)
            experiment = await session.get(
                models.Experiment, _test_data_with_splits["experiment2_id"]
            )
            assert experiment is not None

            # Create and execute the INSERT statement
            insert_stmt = create_experiment_examples_snapshot_insert(experiment)
            await session.execute(insert_stmt)
            await session.flush()

            # Query the junction table
            junction_records = (
                (
                    await session.execute(
                        sa.select(models.ExperimentDatasetExample).where(
                            models.ExperimentDatasetExample.experiment_id == experiment.id
                        )
                    )
                )
                .scalars()
                .all()
            )

            assert len(junction_records) == 1

            record = junction_records[0]
            assert record.dataset_example_id == _test_data_with_splits["example1_id"]
            assert record.dataset_example_revision_id == _test_data_with_splits["revision1_2_id"]

    async def test_snapshot_insert_with_test_split(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test creating snapshot INSERT for experiment with test split only."""
        async with db() as session:
            # Get experiment 3 (test split, version 2)
            experiment = await session.get(
                models.Experiment, _test_data_with_splits["experiment3_id"]
            )
            assert experiment is not None

            # Create and execute the INSERT statement
            insert_stmt = create_experiment_examples_snapshot_insert(experiment)
            await session.execute(insert_stmt)
            await session.flush()

            # Query the junction table
            junction_records = (
                (
                    await session.execute(
                        sa.select(models.ExperimentDatasetExample).where(
                            models.ExperimentDatasetExample.experiment_id == experiment.id
                        )
                    )
                )
                .scalars()
                .all()
            )

            assert len(junction_records) == 1

            record = junction_records[0]
            assert record.dataset_example_id == _test_data_with_splits["example3_id"]
            assert record.dataset_example_revision_id == _test_data_with_splits["revision3_2_id"]

    async def test_snapshot_insert_excludes_delete_revisions(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test that DELETE revisions are excluded from snapshots."""
        async with db() as session:
            # Get experiment 1 (no splits, version 1)
            experiment = await session.get(
                models.Experiment, _test_data_with_splits["experiment1_id"]
            )
            assert experiment is not None

            # Update experiment to use version 2 (where example2 is deleted)
            experiment.dataset_version_id = _test_data_with_splits["version2_id"]
            await session.flush()

            # Create and execute the INSERT statement
            insert_stmt = create_experiment_examples_snapshot_insert(experiment)
            await session.execute(insert_stmt)
            await session.flush()

            # Query the junction table
            junction_records = (
                (
                    await session.execute(
                        sa.select(models.ExperimentDatasetExample).where(
                            models.ExperimentDatasetExample.experiment_id == experiment.id
                        )
                    )
                )
                .scalars()
                .all()
            )

            assert len(junction_records) == 2

            example_ids = {r.dataset_example_id for r in junction_records}
            assert _test_data_with_splits["example1_id"] in example_ids
            assert _test_data_with_splits["example3_id"] in example_ids
            assert _test_data_with_splits["example2_id"] not in example_ids

    async def test_snapshot_insert_statement_structure(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test that the INSERT statement has the correct structure."""
        async with db() as session:
            # Get any experiment
            experiment = await session.get(
                models.Experiment, _test_data_with_splits["experiment1_id"]
            )
            assert experiment is not None

            # Create the INSERT statement
            insert_stmt = create_experiment_examples_snapshot_insert(experiment)

            # Verify statement structure
            assert hasattr(insert_stmt, "table")
            assert insert_stmt.table.name == "experiments_dataset_examples"

            assert len(insert_stmt.table.columns) == 3
            column_names = {col.name for col in insert_stmt.table.columns}
            expected_columns = {
                "experiment_id",
                "dataset_example_id",
                "dataset_example_revision_id",
            }
            assert column_names == expected_columns

    async def test_snapshot_insert_empty_dataset(
        self,
        db: DbSessionFactory,
    ) -> None:
        """Test creating snapshot INSERT for experiment with no examples."""
        async with db() as session:
            # Create a dataset with no examples
            dataset = models.Dataset(name="empty_dataset", description="Empty Dataset")
            session.add(dataset)
            await session.flush()

            version = models.DatasetVersion(dataset_id=dataset.id, description="Empty Version")
            session.add(version)
            await session.flush()

            experiment = models.Experiment(
                dataset_id=dataset.id,
                dataset_version_id=version.id,
                name="empty_experiment",
                description="Empty Experiment",
                repetitions=1,
                metadata_={},
            )
            session.add(experiment)
            await session.flush()

            # Create and execute the INSERT statement
            insert_stmt = create_experiment_examples_snapshot_insert(experiment)
            await session.execute(insert_stmt)
            await session.flush()

            junction_records = (
                (
                    await session.execute(
                        sa.select(models.ExperimentDatasetExample).where(
                            models.ExperimentDatasetExample.experiment_id == experiment.id
                        )
                    )
                )
                .scalars()
                .all()
            )

            assert len(junction_records) == 0

    async def test_snapshot_insert_idempotent(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test that running the same INSERT multiple times doesn't create duplicates."""
        async with db() as session:
            # Get experiment
            experiment = await session.get(
                models.Experiment, _test_data_with_splits["experiment1_id"]
            )
            assert experiment is not None

            # Create and execute the INSERT statement twice
            insert_stmt = create_experiment_examples_snapshot_insert(experiment)
            await session.execute(insert_stmt)
            await session.flush()

            # Execute the same statement again
            insert_stmt2 = create_experiment_examples_snapshot_insert(experiment)

            with pytest.raises(Exception):
                await session.execute(insert_stmt2)
                await session.flush()

    async def test_snapshot_insert_no_duplicates_multi_split_example(
        self,
        db: DbSessionFactory,
        _test_data_with_splits: dict[str, int],
    ) -> None:
        """Test that examples belonging to multiple splits don't create duplicate junction records."""
        async with db() as session:
            # Create an example that belongs to BOTH train and test splits
            dataset = await session.get(models.Dataset, _test_data_with_splits["dataset1_id"])
            assert dataset is not None

            multi_split_example = models.DatasetExample(dataset_id=dataset.id)
            session.add(multi_split_example)
            await session.flush()

            # Create revision for this example
            version = await session.get(
                models.DatasetVersion, _test_data_with_splits["version1_id"]
            )
            assert version is not None

            multi_split_revision = models.DatasetExampleRevision(
                dataset_example_id=multi_split_example.id,
                dataset_version_id=version.id,
                input={"input": "multi_split"},
                output={"output": "multi_split"},
                metadata_={},
                revision_kind="CREATE",
            )
            session.add(multi_split_revision)
            await session.flush()

            # Assign this example to BOTH splits
            train_split = await session.get(
                models.DatasetSplit, _test_data_with_splits["split_train_id"]
            )
            test_split = await session.get(
                models.DatasetSplit, _test_data_with_splits["split_test_id"]
            )
            assert train_split is not None
            assert test_split is not None

            session.add(
                models.DatasetSplitDatasetExample(
                    dataset_split_id=train_split.id, dataset_example_id=multi_split_example.id
                )
            )
            session.add(
                models.DatasetSplitDatasetExample(
                    dataset_split_id=test_split.id, dataset_example_id=multi_split_example.id
                )
            )
            await session.flush()

            # Create an experiment that uses BOTH splits
            multi_split_experiment = models.Experiment(
                dataset_id=dataset.id,
                dataset_version_id=version.id,
                name="Multi Split Experiment",
                description="Test",
                repetitions=1,
                metadata_={},
            )
            session.add(multi_split_experiment)
            await session.flush()

            # Assign both splits to the experiment
            session.add(
                models.ExperimentDatasetSplit(
                    experiment_id=multi_split_experiment.id, dataset_split_id=train_split.id
                )
            )
            session.add(
                models.ExperimentDatasetSplit(
                    experiment_id=multi_split_experiment.id, dataset_split_id=test_split.id
                )
            )
            await session.flush()

            # Generate snapshot insert
            insert_stmt = create_experiment_examples_snapshot_insert(multi_split_experiment)
            await session.execute(insert_stmt)
            await session.flush()

            # Verify exactly ONE junction record exists for the multi-split example
            junction_records = (
                (
                    await session.execute(
                        sa.select(models.ExperimentDatasetExample).where(
                            models.ExperimentDatasetExample.experiment_id
                            == multi_split_experiment.id,
                            models.ExperimentDatasetExample.dataset_example_id
                            == multi_split_example.id,
                        )
                    )
                )
                .scalars()
                .all()
            )

            assert len(junction_records) == 1, (
                f"Expected exactly 1 junction record for multi-split example, got {len(junction_records)}"
            )
            assert junction_records[0].dataset_example_revision_id == multi_split_revision.id
