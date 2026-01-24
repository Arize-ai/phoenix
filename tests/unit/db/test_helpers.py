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


def create_id_subquery(
    *values: int,
) -> Union[Select[tuple[int]], CompoundSelect[tuple[int]]]:
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
        """
        Create comprehensive test data covering all major testing scenarios:

        1. Basic revision functionality (multiple revisions, DELETE handling)
        2. Cross-dataset isolation
        3. Split filtering (basic and overlapping splits)
        4. Duplicate detection with complex split memberships
        5. Version evolution patterns
        """
        async with db() as session:
            # Create datasets
            dataset1 = models.Dataset(name="main_dataset", description="Main Test Dataset")
            dataset2 = models.Dataset(name="isolated_dataset", description="Isolated Dataset")
            session.add_all([dataset1, dataset2])
            await session.flush()

            # Create dataset versions for comprehensive evolution testing
            version1 = models.DatasetVersion(dataset_id=dataset1.id, description="Version 1")
            version2 = models.DatasetVersion(dataset_id=dataset1.id, description="Version 2")
            version3 = models.DatasetVersion(dataset_id=dataset1.id, description="Version 3")
            version_isolated = models.DatasetVersion(
                dataset_id=dataset2.id, description="Version 1"
            )
            session.add_all([version1, version2, version3, version_isolated])
            await session.flush()

            # Create dataset examples covering all patterns
            # Basic examples for revision pattern testing
            basic_example1 = models.DatasetExample(dataset_id=dataset1.id)  # Multi-revision
            basic_example2 = models.DatasetExample(dataset_id=dataset1.id)  # CREATE→DELETE
            basic_example3 = models.DatasetExample(dataset_id=dataset1.id)  # Late creation

            # Split examples for filtering and overlap testing
            split_example1 = models.DatasetExample(dataset_id=dataset1.id)  # Single split
            split_example2 = models.DatasetExample(dataset_id=dataset1.id)  # Two splits
            split_example3 = models.DatasetExample(dataset_id=dataset1.id)  # Three splits
            split_example4 = models.DatasetExample(
                dataset_id=dataset1.id
            )  # All four splits (max overlap)
            split_example5 = models.DatasetExample(dataset_id=dataset1.id)  # No splits (control)

            # Isolated dataset example
            isolated_example = models.DatasetExample(dataset_id=dataset2.id)

            examples = [
                basic_example1,
                basic_example2,
                basic_example3,
                split_example1,
                split_example2,
                split_example3,
                split_example4,
                split_example5,
                isolated_example,
            ]
            session.add_all(examples)
            await session.flush()

            # Create comprehensive split structure
            split_train = models.DatasetSplit(
                name="train",
                description="Training split",
                color="#FF0000",
                metadata_={},
                user_id=None,
            )
            split_val = models.DatasetSplit(
                name="validation",
                description="Validation split",
                color="#00FF00",
                metadata_={},
                user_id=None,
            )
            split_test = models.DatasetSplit(
                name="test",
                description="Test split",
                color="#0000FF",
                metadata_={},
                user_id=None,
            )
            split_extra = models.DatasetSplit(
                name="extra",
                description="Extra split for overlap testing",
                color="#FFFF00",
                metadata_={},
                user_id=None,
            )
            splits = [split_train, split_val, split_test, split_extra]
            session.add_all(splits)
            await session.flush()

            # Create overlapping split assignments for comprehensive testing
            split_assignments = [
                # split_example1: train only
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_train.id,
                    dataset_example_id=split_example1.id,
                ),
                # split_example2: train + validation
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_train.id,
                    dataset_example_id=split_example2.id,
                ),
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_val.id, dataset_example_id=split_example2.id
                ),
                # split_example3: validation + test + extra
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_val.id, dataset_example_id=split_example3.id
                ),
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_test.id, dataset_example_id=split_example3.id
                ),
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_extra.id,
                    dataset_example_id=split_example3.id,
                ),
                # split_example4: all four splits (maximum overlap for duplicate testing)
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_train.id,
                    dataset_example_id=split_example4.id,
                ),
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_val.id, dataset_example_id=split_example4.id
                ),
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_test.id, dataset_example_id=split_example4.id
                ),
                models.DatasetSplitDatasetExample(
                    dataset_split_id=split_extra.id,
                    dataset_example_id=split_example4.id,
                ),
                # split_example5: no splits (control for no-split tests)
            ]
            session.add_all(split_assignments)
            await session.flush()

            # Create comprehensive revision patterns with direct object references
            # Basic example 1: Multiple revisions across versions (CREATE→PATCH→PATCH)
            basic1_v1_revision = models.DatasetExampleRevision(
                dataset_example_id=basic_example1.id,
                dataset_version_id=version1.id,
                input={"test": "basic1_v1"},
                output={"result": "basic1_v1"},
                metadata_={},
                revision_kind="CREATE",
            )
            basic1_v2_revision = models.DatasetExampleRevision(
                dataset_example_id=basic_example1.id,
                dataset_version_id=version2.id,
                input={"test": "basic1_v2"},
                output={"result": "basic1_v2"},
                metadata_={},
                revision_kind="PATCH",
            )
            basic1_v3_revision = models.DatasetExampleRevision(
                dataset_example_id=basic_example1.id,
                dataset_version_id=version3.id,
                input={"test": "basic1_v3"},
                output={"result": "basic1_v3"},
                metadata_={},
                revision_kind="PATCH",
            )

            # Basic example 2: CREATE→DELETE pattern
            basic2_create_revision = models.DatasetExampleRevision(
                dataset_example_id=basic_example2.id,
                dataset_version_id=version1.id,
                input={"test": "basic2_create"},
                output={"result": "basic2_create"},
                metadata_={},
                revision_kind="CREATE",
            )
            basic2_delete_revision = models.DatasetExampleRevision(
                dataset_example_id=basic_example2.id,
                dataset_version_id=version2.id,
                input={"test": "basic2_deleted"},
                output={"result": "basic2_deleted"},
                metadata_={},
                revision_kind="DELETE",
            )

            # Basic example 3: Late creation (only in version 3)
            basic3_revision = models.DatasetExampleRevision(
                dataset_example_id=basic_example3.id,
                dataset_version_id=version3.id,
                input={"test": "basic3_late"},
                output={"result": "basic3_late"},
                metadata_={},
                revision_kind="CREATE",
            )

            # Split examples: All created in version 1, some deleted in version 2
            split1_revision = models.DatasetExampleRevision(
                dataset_example_id=split_example1.id,
                dataset_version_id=version1.id,
                input={"split": "example1_train"},
                output={"result": "split1"},
                metadata_={},
                revision_kind="CREATE",
            )
            split2_revision = models.DatasetExampleRevision(
                dataset_example_id=split_example2.id,
                dataset_version_id=version1.id,
                input={"split": "example2_train_val"},
                output={"result": "split2"},
                metadata_={},
                revision_kind="CREATE",
            )
            # Delete split_example2 in version 2 to test DELETE handling with splits
            split2_delete_revision = models.DatasetExampleRevision(
                dataset_example_id=split_example2.id,
                dataset_version_id=version2.id,
                input={},
                output={},
                metadata_={},
                revision_kind="DELETE",
            )
            split3_revision = models.DatasetExampleRevision(
                dataset_example_id=split_example3.id,
                dataset_version_id=version1.id,
                input={"split": "example3_val_test_extra"},
                output={"result": "split3"},
                metadata_={},
                revision_kind="CREATE",
            )
            split4_revision = models.DatasetExampleRevision(
                dataset_example_id=split_example4.id,
                dataset_version_id=version1.id,
                input={"split": "example4_all_splits"},
                output={"result": "split4_max_overlap"},
                metadata_={},
                revision_kind="CREATE",
            )
            split5_revision = models.DatasetExampleRevision(
                dataset_example_id=split_example5.id,
                dataset_version_id=version1.id,
                input={"split": "example5_no_splits"},
                output={"result": "split5_control"},
                metadata_={},
                revision_kind="CREATE",
            )

            # Isolated dataset example
            isolated_revision = models.DatasetExampleRevision(
                dataset_example_id=isolated_example.id,
                dataset_version_id=version_isolated.id,
                input={"test": "isolated"},
                output={"result": "isolated"},
                metadata_={},
                revision_kind="CREATE",
            )

            # Add all revisions (order doesn't matter now)
            revisions = [
                basic1_v1_revision,
                basic1_v2_revision,
                basic1_v3_revision,
                basic2_create_revision,
                basic2_delete_revision,
                basic3_revision,
                split1_revision,
                split2_revision,
                split2_delete_revision,
                split3_revision,
                split4_revision,
                split5_revision,
                isolated_revision,
            ]
            session.add_all(revisions)
            await session.flush()

            # Return comprehensive mapping for all test scenarios
            return {
                # Datasets
                "dataset1_id": dataset1.id,
                "dataset2_id": dataset2.id,
                # Versions
                "version1_id": version1.id,
                "version2_id": version2.id,
                "version3_id": version3.id,
                "version_isolated_id": version_isolated.id,
                # Basic examples (for revision pattern testing)
                "basic_example1_id": basic_example1.id,  # Multi-revision
                "basic_example2_id": basic_example2.id,  # CREATE→DELETE
                "basic_example3_id": basic_example3.id,  # Late creation
                # Split examples (for split filtering and overlap testing)
                "split_example1_id": split_example1.id,  # train only
                "split_example2_id": split_example2.id,  # train + val (deleted in v2)
                "split_example3_id": split_example3.id,  # val + test + extra
                "split_example4_id": split_example4.id,  # all four splits (max overlap)
                "split_example5_id": split_example5.id,  # no splits (control)
                # Isolated example
                "isolated_example_id": isolated_example.id,
                # Splits
                "split_train_id": split_train.id,
                "split_val_id": split_val.id,
                "split_test_id": split_test.id,
                "split_extra_id": split_extra.id,
                # Revision IDs for specific testing (using direct object references)
                "basic1_v1_revision_id": basic1_v1_revision.id,
                "basic1_v2_revision_id": basic1_v2_revision.id,
                "basic1_v3_revision_id": basic1_v3_revision.id,
                "basic2_create_revision_id": basic2_create_revision.id,
                "basic2_delete_revision_id": basic2_delete_revision.id,
                "basic3_revision_id": basic3_revision.id,
                "split1_revision_id": split1_revision.id,
                "split2_revision_id": split2_revision.id,
                "split2_delete_revision_id": split2_delete_revision.id,
                "split3_revision_id": split3_revision.id,
                "split4_revision_id": split4_revision.id,
                "split5_revision_id": split5_revision.id,
                "isolated_revision_id": isolated_revision.id,
            }

    async def test_revision_evolution_and_delete_handling(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """
        Comprehensive test of revision evolution: CREATE→PATCH→DELETE patterns.
        This consolidates basic functionality and DELETE exclusion testing.
        """
        async with db() as session:
            # Version 1: Initial state
            query = get_dataset_example_revisions(_test_data["version1_id"])
            v1_revisions = (await session.scalars(query)).all()
            v1_example_ids = {r.dataset_example_id for r in v1_revisions}
            v1_revision_ids = {r.id for r in v1_revisions}

            # Should get 7 examples initially (basic_example1, basic_example2, split_example1-5)
            assert len(v1_revisions) == 7
            assert _test_data["basic_example1_id"] in v1_example_ids
            assert _test_data["basic_example2_id"] in v1_example_ids
            assert _test_data["basic1_v1_revision_id"] in v1_revision_ids
            assert _test_data["basic2_create_revision_id"] in v1_revision_ids

            # Version 2: Updates and deletions
            query = get_dataset_example_revisions(_test_data["version2_id"])
            v2_revisions = (await session.scalars(query)).all()
            v2_example_ids = {r.dataset_example_id for r in v2_revisions}
            v2_revision_ids = {r.id for r in v2_revisions}

            # Should get fewer examples (basic_example2 and split_example2 are DELETEd)
            assert len(v2_revisions) == 5  # Lost 2 to DELETE
            assert _test_data["basic_example1_id"] in v2_example_ids  # Updated
            assert _test_data["basic1_v2_revision_id"] in v2_revision_ids  # Latest revision
            assert _test_data["basic_example2_id"] not in v2_example_ids  # DELETED - excluded

            # Version 3: New additions + persistent deletions
            query = get_dataset_example_revisions(_test_data["version3_id"])
            v3_revisions = (await session.scalars(query)).all()
            v3_example_ids = {r.dataset_example_id for r in v3_revisions}
            v3_revision_ids = {r.id for r in v3_revisions}

            # Should get latest state with new example
            assert len(v3_revisions) == 6  # Added basic_example3
            assert _test_data["basic_example1_id"] in v3_example_ids
            assert _test_data["basic1_v3_revision_id"] in v3_revision_ids  # Latest revision
            assert _test_data["basic_example2_id"] not in v3_example_ids  # Still deleted
            assert _test_data["basic_example3_id"] in v3_example_ids  # New addition
            assert _test_data["basic3_revision_id"] in v3_revision_ids

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
            query = get_dataset_example_revisions(_test_data["version_isolated_id"])
            revisions = (await session.scalars(query)).all()

            example_ids = [r.dataset_example_id for r in revisions]

            # Should only get the one example from dataset2
            assert len(revisions) == 1
            assert _test_data["isolated_example_id"] in example_ids

            # Should NOT contain any examples from dataset1
            dataset1_examples = [
                _test_data["basic_example1_id"],
                _test_data["basic_example2_id"],
                _test_data["basic_example3_id"],
            ]
            for example_id in dataset1_examples:
                assert example_id not in example_ids

    async def test_example_ids_filtering_and_delete_interaction(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """
        Comprehensive test of example_ids filtering including DELETE exclusion,
        cross-dataset isolation, and dataset_id optimization.
        """
        async with db() as session:
            # Test 1: Single example ID filtering
            example_ids_query = select(literal(_test_data["basic_example1_id"]))
            query = get_dataset_example_revisions(
                _test_data["version2_id"], example_ids=example_ids_query
            )
            revisions = (await session.scalars(query)).all()

            assert len(revisions) == 1
            assert revisions[0].dataset_example_id == _test_data["basic_example1_id"]
            assert revisions[0].id == _test_data["basic1_v2_revision_id"]  # Latest revision

            # Test 2: Multiple example IDs
            example_ids_query = select(literal(_test_data["basic_example1_id"])).union_all(
                select(literal(_test_data["basic_example3_id"]))
            )  # type: ignore[assignment]
            query = get_dataset_example_revisions(
                _test_data["version3_id"], example_ids=example_ids_query
            )
            revisions = (await session.scalars(query)).all()

            revision_example_ids = {r.dataset_example_id for r in revisions}
            assert len(revisions) == 2
            assert _test_data["basic_example1_id"] in revision_example_ids
            assert _test_data["basic_example3_id"] in revision_example_ids
            assert _test_data["basic_example2_id"] not in revision_example_ids  # Deleted

            # Test 3: DELETE exclusion with example_ids filtering
            example_ids_query = select(literal(_test_data["basic_example2_id"]))
            query = get_dataset_example_revisions(
                _test_data["version2_id"], example_ids=example_ids_query
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0  # Filtered example is DELETEd, should be excluded

            # Test 4: Cross-dataset isolation
            example_ids_query = select(literal(_test_data["basic_example1_id"]))
            query = get_dataset_example_revisions(
                _test_data["version_isolated_id"], example_ids=example_ids_query
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0  # Example belongs to different dataset

            # Test 5: dataset_id optimization with example_ids
            example_ids_query = select(literal(_test_data["basic_example1_id"]))
            query = get_dataset_example_revisions(
                _test_data["version2_id"],
                dataset_id=_test_data["dataset1_id"],
                example_ids=example_ids_query,
            )
            revisions = (await session.scalars(query)).all()

            # Should get the same result as without dataset_id
            assert len(revisions) == 1
            assert revisions[0].dataset_example_id == _test_data["basic_example1_id"]
            assert revisions[0].id == _test_data["basic1_v2_revision_id"]

            # Test 6: Empty example_ids subquery (strict filtering)
            example_ids_query = select(literal(99999)).where(literal(False))
            query = get_dataset_example_revisions(
                _test_data["version2_id"], example_ids=example_ids_query
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

    async def test_empty_and_invalid_input_scenarios(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """
        Comprehensive test of empty and invalid input scenarios.
        Consolidates all empty/invalid input tests with strict filtering behavior.
        """
        async with db() as session:
            # Test 1: Empty lists/sequences (strict filtering)
            # Empty example_ids
            query = get_dataset_example_revisions(_test_data["version1_id"], example_ids=[])
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0, "Expected 0 results for empty example_ids"

            # Empty split_ids
            query = get_dataset_example_revisions(_test_data["version1_id"], split_ids=[])
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0, "Expected 0 results for empty split_ids"

            # Empty split_names
            query = get_dataset_example_revisions(_test_data["version1_id"], split_names=[])
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0, "Expected 0 results for empty split_names"

            # Test 2: Empty subqueries (strict filtering)
            # Empty example_ids subquery
            example_ids_query = select(literal(99999)).where(literal(False))
            query = get_dataset_example_revisions(
                _test_data["version2_id"], example_ids=example_ids_query
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

            # Empty split_ids subquery
            split_ids_query = select(literal(99999)).where(literal(False))
            query = get_dataset_example_revisions(
                _test_data["version1_id"], split_ids=split_ids_query
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

            # Empty split_names subquery
            split_names_query = select(literal("nonexistent")).where(literal(False))
            query = get_dataset_example_revisions(
                _test_data["version1_id"], split_names=split_names_query
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

            # Test 3: Nonexistent resources
            # Nonexistent version
            query = get_dataset_example_revisions(99999)
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

            # Nonexistent split name
            query = get_dataset_example_revisions(
                _test_data["version1_id"], split_names=["nonexistent"]
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

            # Nonexistent split ID
            query = get_dataset_example_revisions(
                _test_data["version1_id"], split_ids=[NONEXISTENT_ID]
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

            # Test 4: Mixed empty filters (strict filtering)
            # Empty example_ids + valid split_ids should return 0
            query = get_dataset_example_revisions(
                _test_data["version1_id"],
                example_ids=[],
                split_ids=[_test_data["split_train_id"]],
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

            # Valid example_ids + empty split_ids should return 0
            query = get_dataset_example_revisions(
                _test_data["version1_id"],
                example_ids=[_test_data["basic_example1_id"]],
                split_ids=[],
            )
            revisions = (await session.scalars(query)).all()
            assert len(revisions) == 0

    async def test_get_revisions_split_ids_and_names_mutual_exclusion(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """Test that providing both split_ids and split_names raises an error."""
        async with db() as session:
            # Test that providing both split_ids and split_names raises ValueError
            with pytest.raises(
                ValueError,
                match="Cannot specify both split_ids and split_names - they are mutually exclusive",
            ):
                query = get_dataset_example_revisions(
                    _test_data["version1_id"],
                    split_ids=[_test_data["split_train_id"]],
                    split_names=["train"],
                )
                await session.execute(query)

    @pytest.mark.parametrize("use_split_ids", [False, True])
    async def test_no_duplicates_with_maximum_overlap_scenarios(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
        use_split_ids: bool,
    ) -> None:
        """
        Test challenging overlap scenarios to ensure no duplicates are returned.
        Verifies that examples belonging to multiple splits appear exactly once in results.
        """
        async with db() as session:
            # Test with maximum overlap: all 4 splits (train, validation, test, extra)
            # This creates the highest risk scenario for duplicates
            if use_split_ids:
                # Test using split IDs (more efficient)
                query = get_dataset_example_revisions(
                    _test_data["version1_id"],
                    split_ids=[
                        _test_data["split_train_id"],
                        _test_data["split_val_id"],
                        _test_data["split_test_id"],
                        _test_data["split_extra_id"],
                    ],
                )
            else:
                # Test using split names
                query = get_dataset_example_revisions(
                    _test_data["version1_id"],
                    split_names=["train", "validation", "test", "extra"],
                )

            revisions = (await session.scalars(query)).all()

            # Collect IDs for comprehensive duplicate analysis
            revision_ids = [r.id for r in revisions]
            example_ids = [r.dataset_example_id for r in revisions]

            # Check for duplicate revision IDs
            unique_revision_ids = set(revision_ids)
            assert len(revision_ids) == len(unique_revision_ids), (
                f"Duplicate revision IDs detected! "
                f"Total: {len(revision_ids)}, Unique: {len(unique_revision_ids)}, "
                f"Duplicates: {[rid for rid in revision_ids if revision_ids.count(rid) > 1]}"
            )

            # Check for duplicate example IDs
            unique_example_ids = set(example_ids)
            assert len(example_ids) == len(unique_example_ids), (
                f"Duplicate example IDs detected! "
                f"Total: {len(example_ids)}, Unique: {len(unique_example_ids)}, "
                f"Duplicates: {[eid for eid in example_ids if example_ids.count(eid) > 1]}"
            )

            # Expected examples based on our comprehensive fixture:
            # - split_example1: train only
            # - split_example2: train + val (but deleted in v2, so not in v1 results)
            # - split_example3: val + test + extra
            # - split_example4: all four splits (MAXIMUM OVERLAP - most likely to cause duplicates)
            # - split_example5: no splits (should not appear)
            expected_example_ids = {
                _test_data["split_example1_id"],  # train
                _test_data["split_example2_id"],  # train + val
                _test_data["split_example3_id"],  # val + test + extra
                _test_data["split_example4_id"],  # ALL FOUR (maximum overlap)
            }

            assert unique_example_ids == expected_example_ids, (
                f"Split filtering returned unexpected examples. "
                f"Expected: {expected_example_ids}, Got: {unique_example_ids}. "
                f"Method: {'split_ids' if use_split_ids else 'split_names'}"
            )

            # Should have exactly 4 revisions (one per example) - any more indicates duplicates
            assert len(revisions) == 4, (
                f"Expected exactly 4 revisions (one per example), got {len(revisions)}. "
                f"Method: {'split_ids' if use_split_ids else 'split_names'}"
            )

            # Verify the maximum overlap example (split_example4) appears exactly once
            split_example4_revisions = [
                r for r in revisions if r.dataset_example_id == _test_data["split_example4_id"]
            ]
            assert len(split_example4_revisions) == 1, (
                f"split_example4 (in all 4 splits) appears {len(split_example4_revisions)} times "
                f"instead of exactly once. Each example should appear exactly once."
            )


class TestCreateExperimentExamplesSnapshotInsert:
    @pytest.fixture
    async def _test_data(
        self,
        db: DbSessionFactory,
    ) -> dict[str, int]:
        """Create test data including dataset splits for snapshot tests."""
        async with db() as session:
            # Create datasets
            dataset1 = models.Dataset(name="test_dataset_1", description="Test Dataset 1")
            dataset2 = models.Dataset(name="test_dataset_2", description="Test Dataset 2")
            deleted_dataset = models.Dataset(
                name="deleted_test_dataset", description="Dataset for DELETE test"
            )
            session.add_all([dataset1, dataset2, deleted_dataset])
            await session.flush()

            # Create dataset versions
            version1 = models.DatasetVersion(dataset_id=dataset1.id, description="Version 1")
            version2 = models.DatasetVersion(dataset_id=dataset1.id, description="Version 2")
            deleted_initial_version = models.DatasetVersion(
                dataset_id=deleted_dataset.id, description="Initial Version"
            )
            deleted_version = models.DatasetVersion(
                dataset_id=deleted_dataset.id, description="All Deleted Version"
            )
            session.add_all([version1, version2, deleted_initial_version, deleted_version])
            await session.flush()

            # Create dataset examples
            example1 = models.DatasetExample(dataset_id=dataset1.id)
            example2 = models.DatasetExample(dataset_id=dataset1.id)
            example3 = models.DatasetExample(dataset_id=dataset1.id)
            # Examples for DELETE testing
            delete_example1 = models.DatasetExample(dataset_id=deleted_dataset.id)
            delete_example2 = models.DatasetExample(dataset_id=deleted_dataset.id)
            delete_example3 = models.DatasetExample(dataset_id=deleted_dataset.id)
            session.add_all(
                [
                    example1,
                    example2,
                    example3,
                    delete_example1,
                    delete_example2,
                    delete_example3,
                ]
            )
            await session.flush()

            # Create dataset splits
            split_train = models.DatasetSplit(
                name="train",
                description="Training split",
                color="#FF0000",
                metadata_={"split_type": "percentage", "split_value": 0.8},
                user_id=None,
            )
            split_test = models.DatasetSplit(
                name="test",
                description="Test split",
                color="#00FF00",
                metadata_={"split_type": "percentage", "split_value": 0.2},
                user_id=None,
            )
            split_empty = models.DatasetSplit(
                name="empty_split",
                description="Split with no examples",
                color="#FF00FF",
                metadata_={},
                user_id=None,
            )
            session.add_all([split_train, split_test, split_empty])
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

            # Create dataset example revisions with direct object references
            # Example 1: CREATE in version 1
            basic1_v1_revision = models.DatasetExampleRevision(
                dataset_example_id=example1.id,
                dataset_version_id=version1.id,
                input={"test": "example1_v1"},
                output={"result": "example1_v1"},
                metadata_={},
                revision_kind="CREATE",
            )
            # Example 1: PATCH in version 2
            basic1_v2_revision = models.DatasetExampleRevision(
                dataset_example_id=example1.id,
                dataset_version_id=version2.id,
                input={"test": "example1_v2"},
                output={"result": "example1_v2"},
                metadata_={},
                revision_kind="PATCH",
            )
            # Example 2: CREATE in version 1
            basic2_create_revision = models.DatasetExampleRevision(
                dataset_example_id=example2.id,
                dataset_version_id=version1.id,
                input={"test": "example2_v1"},
                output={"result": "example2_v1"},
                metadata_={},
                revision_kind="CREATE",
            )
            # Example 2: DELETE in version 2
            basic2_delete_revision = models.DatasetExampleRevision(
                dataset_example_id=example2.id,
                dataset_version_id=version2.id,
                input={"test": "deleted"},
                output={"result": "deleted"},
                metadata_={},
                revision_kind="DELETE",
            )
            # Example 3: CREATE in version 2
            revision3_2 = models.DatasetExampleRevision(
                dataset_example_id=example3.id,
                dataset_version_id=version2.id,
                input={"test": "example3_v2"},
                output={"result": "example3_v2"},
                metadata_={},
                revision_kind="CREATE",
            )

            # DELETE test examples: initial CREATE revisions
            delete1_create_revision = models.DatasetExampleRevision(
                dataset_example_id=delete_example1.id,
                dataset_version_id=deleted_initial_version.id,
                input={"test": "delete_example1"},
                output={"result": "delete_example1"},
                metadata_={},
                revision_kind="CREATE",
            )
            delete2_create_revision = models.DatasetExampleRevision(
                dataset_example_id=delete_example2.id,
                dataset_version_id=deleted_initial_version.id,
                input={"test": "delete_example2"},
                output={"result": "delete_example2"},
                metadata_={},
                revision_kind="CREATE",
            )
            delete3_create_revision = models.DatasetExampleRevision(
                dataset_example_id=delete_example3.id,
                dataset_version_id=deleted_initial_version.id,
                input={"test": "delete_example3"},
                output={"result": "delete_example3"},
                metadata_={},
                revision_kind="CREATE",
            )

            # DELETE test examples: all deleted in later version
            delete1_delete_revision = models.DatasetExampleRevision(
                dataset_example_id=delete_example1.id,
                dataset_version_id=deleted_version.id,
                input={},
                output={},
                metadata_={},
                revision_kind="DELETE",
            )
            delete2_delete_revision = models.DatasetExampleRevision(
                dataset_example_id=delete_example2.id,
                dataset_version_id=deleted_version.id,
                input={},
                output={},
                metadata_={},
                revision_kind="DELETE",
            )
            delete3_delete_revision = models.DatasetExampleRevision(
                dataset_example_id=delete_example3.id,
                dataset_version_id=deleted_version.id,
                input={},
                output={},
                metadata_={},
                revision_kind="DELETE",
            )

            # Add all revisions (order doesn't matter now)
            revisions = [
                basic1_v1_revision,
                basic1_v2_revision,
                basic2_create_revision,
                basic2_delete_revision,
                revision3_2,
                delete1_create_revision,
                delete2_create_revision,
                delete3_create_revision,
                delete1_delete_revision,
                delete2_delete_revision,
                delete3_delete_revision,
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

            # Experiment for empty split testing
            empty_split_experiment = models.Experiment(
                dataset_id=dataset1.id,
                dataset_version_id=version1.id,
                name="empty_split_experiment",
                description="Experiment with empty split",
                repetitions=1,
                metadata_={},
            )

            # Experiment for all-deleted testing
            all_deleted_experiment = models.Experiment(
                dataset_id=deleted_dataset.id,
                dataset_version_id=deleted_version.id,
                name="all_deleted_experiment",
                description="Experiment where all examples are deleted",
                repetitions=1,
                metadata_={},
            )

            # Create additional experiments to avoid mutation of shared ones
            # Experiment for DELETE exclusion testing (using version 2)
            delete_exclusion_experiment = models.Experiment(
                dataset_id=dataset1.id,
                dataset_version_id=version2.id,
                name="delete_exclusion_experiment",
                description="Experiment for testing DELETE exclusion",
                repetitions=1,
                metadata_={},
            )

            # Empty dataset and experiment for edge case testing
            empty_dataset = models.Dataset(name="empty_dataset", description="Empty Dataset")
            session.add(empty_dataset)
            await session.flush()

            empty_version = models.DatasetVersion(
                dataset_id=empty_dataset.id, description="Empty Version"
            )
            session.add(empty_version)
            await session.flush()

            empty_dataset_experiment = models.Experiment(
                dataset_id=empty_dataset.id,
                dataset_version_id=empty_version.id,
                name="empty_dataset_experiment",
                description="Experiment with empty dataset",
                repetitions=1,
                metadata_={},
            )

            # Experiment for idempotent testing (separate from experiment1)
            idempotent_test_experiment = models.Experiment(
                dataset_id=dataset1.id,
                dataset_version_id=version1.id,
                name="idempotent_test_experiment",
                description="Experiment for idempotent testing",
                repetitions=1,
                metadata_={},
            )

            session.add_all(
                [
                    experiment1,
                    experiment2,
                    experiment3,
                    empty_split_experiment,
                    all_deleted_experiment,
                    delete_exclusion_experiment,
                    empty_dataset_experiment,
                    idempotent_test_experiment,
                ]
            )
            await session.flush()

            # Assign splits to experiments
            exp2_split = models.ExperimentDatasetSplit(
                experiment_id=experiment2.id, dataset_split_id=split_train.id
            )
            exp3_split = models.ExperimentDatasetSplit(
                experiment_id=experiment3.id, dataset_split_id=split_test.id
            )
            empty_split_exp_split = models.ExperimentDatasetSplit(
                experiment_id=empty_split_experiment.id, dataset_split_id=split_empty.id
            )
            session.add_all([exp2_split, exp3_split, empty_split_exp_split])
            await session.flush()

            return {
                "dataset1_id": dataset1.id,
                "dataset2_id": dataset2.id,
                "deleted_dataset_id": deleted_dataset.id,
                "empty_dataset_id": empty_dataset.id,
                "version1_id": version1.id,
                "version2_id": version2.id,
                "deleted_initial_version_id": deleted_initial_version.id,
                "deleted_version_id": deleted_version.id,
                "empty_version_id": empty_version.id,
                "basic_example1_id": example1.id,
                "basic_example2_id": example2.id,
                "basic_example3_id": example3.id,
                "delete_example1_id": delete_example1.id,
                "delete_example2_id": delete_example2.id,
                "delete_example3_id": delete_example3.id,
                "split_train_id": split_train.id,
                "split_test_id": split_test.id,
                "split_empty_id": split_empty.id,
                "experiment1_id": experiment1.id,
                "experiment2_id": experiment2.id,
                "experiment3_id": experiment3.id,
                "empty_split_experiment_id": empty_split_experiment.id,
                "all_deleted_experiment_id": all_deleted_experiment.id,
                "delete_exclusion_experiment_id": delete_exclusion_experiment.id,
                "empty_dataset_experiment_id": empty_dataset_experiment.id,
                "idempotent_test_experiment_id": idempotent_test_experiment.id,
                "basic1_v1_revision_id": basic1_v1_revision.id,
                "basic1_v2_revision_id": basic1_v2_revision.id,
                "basic2_create_revision_id": basic2_create_revision.id,
                "basic2_delete_revision_id": basic2_delete_revision.id,
                "revision3_2_id": revision3_2.id,
                "delete1_create_revision_id": delete1_create_revision.id,
                "delete2_create_revision_id": delete2_create_revision.id,
                "delete3_create_revision_id": delete3_create_revision.id,
                "delete1_delete_revision_id": delete1_delete_revision.id,
                "delete2_delete_revision_id": delete2_delete_revision.id,
                "delete3_delete_revision_id": delete3_delete_revision.id,
            }

    async def test_snapshot_insert_core_functionality_and_delete_exclusion(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """
        Comprehensive test of core snapshot functionality including DELETE exclusion.
        Tests both basic operation and DELETE revision filtering.
        """
        async with db() as session:
            # Test 1: Basic functionality without splits (version 1)
            experiment1 = await session.get(models.Experiment, _test_data["experiment1_id"])
            assert experiment1 is not None

            insert_stmt = create_experiment_examples_snapshot_insert(experiment1)
            await session.execute(insert_stmt)
            await session.flush()

            # Verify basic functionality
            junction_records = (
                (
                    await session.execute(
                        sa.select(models.ExperimentDatasetExample).where(
                            models.ExperimentDatasetExample.experiment_id == experiment1.id
                        )
                    )
                )
                .scalars()
                .all()
            )

            assert len(junction_records) == 2
            record_map = {r.dataset_example_id: r for r in junction_records}
            assert _test_data["basic_example1_id"] in record_map
            assert _test_data["basic_example2_id"] in record_map
            assert (
                record_map[_test_data["basic_example1_id"]].dataset_example_revision_id
                == _test_data["basic1_v1_revision_id"]
            )
            assert (
                record_map[_test_data["basic_example2_id"]].dataset_example_revision_id
                == _test_data["basic2_create_revision_id"]
            )

            # Test 2: DELETE exclusion - Use separate experiment already configured for version 2
            delete_exclusion_experiment = await session.get(
                models.Experiment, _test_data["delete_exclusion_experiment_id"]
            )
            assert delete_exclusion_experiment is not None

            # Create snapshot with DELETE exclusion (uses version 2 where example2 is deleted)
            insert_stmt = create_experiment_examples_snapshot_insert(delete_exclusion_experiment)
            await session.execute(insert_stmt)
            await session.flush()

            # Verify DELETE revisions are excluded
            junction_records = (
                (
                    await session.execute(
                        sa.select(models.ExperimentDatasetExample).where(
                            models.ExperimentDatasetExample.experiment_id
                            == delete_exclusion_experiment.id
                        )
                    )
                )
                .scalars()
                .all()
            )

            assert len(junction_records) == 2
            example_ids = {r.dataset_example_id for r in junction_records}
            assert _test_data["basic_example1_id"] in example_ids  # Updated in v2
            assert _test_data["basic_example3_id"] in example_ids  # Created in v2
            assert _test_data["basic_example2_id"] not in example_ids  # Deleted in v2

    @pytest.mark.parametrize(
        "experiment_key,expected_example_key,expected_revision_key",
        [
            (
                "experiment2_id",
                "basic_example1_id",
                "basic1_v2_revision_id",
            ),  # train split
            ("experiment3_id", "basic_example3_id", "revision3_2_id"),  # test split
        ],
    )
    async def test_snapshot_insert_with_split_filtering(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
        experiment_key: str,
        expected_example_key: str,
        expected_revision_key: str,
    ) -> None:
        """Test creating snapshot INSERT for experiments with split filtering."""
        async with db() as session:
            experiment = await session.get(models.Experiment, _test_data[experiment_key])
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

            # Should have exactly one record for the split
            assert len(junction_records) == 1

            record = junction_records[0]
            assert record.dataset_example_id == _test_data[expected_example_key]
            assert record.dataset_example_revision_id == _test_data[expected_revision_key]

    async def test_snapshot_insert_empty_result_scenarios(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """
        Comprehensive test of scenarios that should result in empty snapshots:
        1. Empty dataset (no examples at all)
        2. Experiment with splits but no examples belong to those splits
        3. All examples deleted in target version
        """
        async with db() as session:
            # Test 1: Empty dataset (no examples at all)
            empty_dataset_experiment = await session.get(
                models.Experiment, _test_data["empty_dataset_experiment_id"]
            )
            assert empty_dataset_experiment is not None

            insert_stmt = create_experiment_examples_snapshot_insert(empty_dataset_experiment)
            await session.execute(insert_stmt)
            await session.flush()

            junction_records = (
                (
                    await session.execute(
                        sa.select(models.ExperimentDatasetExample).where(
                            models.ExperimentDatasetExample.experiment_id
                            == empty_dataset_experiment.id
                        )
                    )
                )
                .scalars()
                .all()
            )
            assert len(junction_records) == 0

            # Test 2: Experiment with splits but no examples belong to those splits
            empty_split_experiment = await session.get(
                models.Experiment, _test_data["empty_split_experiment_id"]
            )
            assert empty_split_experiment is not None

            insert_stmt = create_experiment_examples_snapshot_insert(empty_split_experiment)
            await session.execute(insert_stmt)
            await session.flush()

            junction_records = (
                (
                    await session.execute(
                        sa.select(models.ExperimentDatasetExample).where(
                            models.ExperimentDatasetExample.experiment_id
                            == empty_split_experiment.id
                        )
                    )
                )
                .scalars()
                .all()
            )
            assert len(junction_records) == 0

            # Test 3: All examples deleted in target version
            all_deleted_experiment = await session.get(
                models.Experiment, _test_data["all_deleted_experiment_id"]
            )
            assert all_deleted_experiment is not None

            insert_stmt = create_experiment_examples_snapshot_insert(all_deleted_experiment)
            await session.execute(insert_stmt)
            await session.flush()

            junction_records = (
                (
                    await session.execute(
                        sa.select(models.ExperimentDatasetExample).where(
                            models.ExperimentDatasetExample.experiment_id
                            == all_deleted_experiment.id
                        )
                    )
                )
                .scalars()
                .all()
            )
            assert len(junction_records) == 0

    async def test_snapshot_insert_idempotent_behavior(
        self,
        db: DbSessionFactory,
        _test_data: dict[str, int],
    ) -> None:
        """
        Test idempotent behavior: inserting the same experiment snapshot twice should fail.
        """
        async with db() as session:
            idempotent_experiment = await session.get(
                models.Experiment, _test_data["idempotent_test_experiment_id"]
            )
            assert idempotent_experiment is not None

            # First INSERT should succeed
            insert_stmt1 = create_experiment_examples_snapshot_insert(idempotent_experiment)
            await session.execute(insert_stmt1)
            await session.flush()

            # Second INSERT should fail (duplicate prevention)
            insert_stmt2 = create_experiment_examples_snapshot_insert(idempotent_experiment)
            with pytest.raises(Exception):
                await session.execute(insert_stmt2)
                await session.flush()
