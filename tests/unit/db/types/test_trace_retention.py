from collections import defaultdict
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from itertools import chain
from secrets import token_hex
from typing import Any, Dict, Type, Union

import pytest
import sqlalchemy as sa
from faker import Faker
from freezegun import freeze_time
from pydantic import ValidationError

from phoenix.db import models
from phoenix.db.types.trace_retention import (
    MaxCountRule,
    MaxDaysOrCountRule,
    MaxDaysRule,
    TraceRetentionRule,
    _MaxCount,
    _MaxDays,
    _time_of_next_run,
)
from phoenix.server.types import DbSessionFactory

fake = Faker()


class TestMaxDaysMixin:
    @pytest.mark.parametrize(
        "max_days,is_valid",
        [
            pytest.param(0, True, id="zero_days"),
            pytest.param(0.5, True, id="half_days"),
            pytest.param(-10, False, id="negative_days"),
        ],
    )
    def test_init(self, max_days: float, is_valid: bool) -> None:
        """Test that _MaxDays fails with invalid inputs."""
        with nullcontext() if is_valid else pytest.raises(ValidationError):
            _MaxDays(max_days=max_days)

    @pytest.mark.parametrize(
        "max_days,expected",
        [
            pytest.param(0, "false", id="zero_days"),
            pytest.param(0.5, "traces.start_time < '2023-01-15 00:00:00+00:00'", id="half_days"),
        ],
    )
    def test_filter(self, max_days: int, expected: str) -> None:
        """Test that max_days_filter generates correct SQL query."""
        rule: _MaxDays = _MaxDays(max_days=max_days)
        with freeze_time("2023-01-15 12:00:00", tz_offset=0):
            actual = str(rule.max_days_filter.compile(compile_kwargs={"literal_binds": True}))
        assert actual == expected


class TestMaxCountMixin:
    @pytest.mark.parametrize(
        "max_count,is_valid",
        [
            pytest.param(0, True, id="zero_count"),
            pytest.param(10, True, id="ten_count"),
            pytest.param(0.5, False, id="float_count"),
            pytest.param(-10, False, id="negative_count"),
        ],
    )
    def test_init(self, max_count: int, is_valid: bool) -> None:
        """Test that _MaxCount fails with invalid inputs."""
        with nullcontext() if is_valid else pytest.raises(ValidationError):
            _MaxCount(max_count=max_count)

    @pytest.mark.parametrize(
        "max_count,expected",
        [
            pytest.param(0, "false", id="zero_count"),
        ],
    )
    def test_filter(self, max_count: int, expected: str) -> None:
        """Test that max_count_filter generates correct SQL query."""
        rule: _MaxCount = _MaxCount(max_count=max_count)
        actual = str(rule.max_count_filter(()).compile(compile_kwargs={"literal_binds": True}))
        actual = " ".join(actual.split())
        assert actual == expected


class TestTraceRetentionRuleMaxDays:
    """Test the MaxDaysRule which enforces a time-based retention policy.

    This rule deletes traces that are older than the specified max_days.
    The test verifies that:
    - Projects with traces older than max_days have only their most recent trace kept
    - Unaffected projects retain all their traces
    """

    @pytest.mark.parametrize("scalar_subquery", [True, False])
    async def test_delete_traces(
        self,
        scalar_subquery: bool,
        db: DbSessionFactory,
    ) -> None:
        # Setup test data
        affected_projects: defaultdict[int, list[int]] = defaultdict(list)
        unaffected_projects: defaultdict[int, list[int]] = defaultdict(list)
        num_projects = 10  # half will be affected, half will be unaffected

        async with db() as session:
            # Create projects with traces of varying ages. Each affected project
            # should have one trace remaining after deletion.
            for i in range(num_projects):
                project = models.Project(name=token_hex(8))
                session.add(project)
                await session.flush()
                start_time = fake.date_time_between(start_date="-12h", tzinfo=timezone.utc)
                for days in range(5):
                    trace = models.Trace(
                        project_rowid=project.id,
                        trace_id=token_hex(16),
                        start_time=start_time - timedelta(days=days),
                        end_time=datetime.now(timezone.utc),
                    )
                    session.add(trace)
                    await session.flush()
                    if i < num_projects // 2:
                        affected_projects[project.id].append(trace.id)
                    else:
                        unaffected_projects[project.id].append(trace.id)

        assert affected_projects, "Should be non-empty"
        assert unaffected_projects, "Should be non-empty"

        # Apply retention rule
        rule = MaxDaysRule(max_days=1)
        async with db() as session:
            if scalar_subquery:
                await rule.delete_traces(
                    session,
                    sa.select(models.Project.id)
                    .where(models.Project.id.in_(affected_projects.keys()))
                    .scalar_subquery(),
                )
            else:
                await rule.delete_traces(session, affected_projects.keys())

        # Verify affected projects have only one trace
        async with db() as session:
            remaining_traces = await session.scalars(
                sa.select(models.Trace.id).where(
                    models.Trace.project_rowid.in_(affected_projects.keys())
                )
            )
        assert set(remaining_traces.all()) == set(
            traces[0] for traces in affected_projects.values()
        ), "Each affected project should retain only its most recent trace"

        # Verify unaffected projects are untouched
        async with db() as session:
            remaining_traces = await session.scalars(
                sa.select(models.Trace.id).where(
                    models.Trace.project_rowid.in_(unaffected_projects.keys())
                )
            )
        assert set(remaining_traces.all()) == set(
            chain.from_iterable(unaffected_projects.values())
        ), "Unaffected projects should retain all their traces"


class TestTraceRetentionRuleMaxCount:
    """Test the MaxCountRule which enforces a count-based retention policy.

    This rule keeps only the most recent max_count traces for each project.
    The test verifies that:
    - Projects with more than max_count traces have only their most recent trace kept
    - Unaffected projects retain all their traces
    """

    @pytest.mark.parametrize("scalar_subquery", [True, False])
    async def test_delete_traces(
        self,
        scalar_subquery: bool,
        db: DbSessionFactory,
    ) -> None:
        # Setup test data
        affected_projects: defaultdict[int, list[int]] = defaultdict(list)
        unaffected_projects: defaultdict[int, list[int]] = defaultdict(list)
        num_projects = 10  # half will be affected, half will be unaffected

        async with db() as session:
            # Create projects with multiple traces. Each affected project should
            # have one trace remaining after deletion.
            for i in range(num_projects):
                project = models.Project(name=token_hex(8))
                session.add(project)
                await session.flush()
                start_time = fake.date_time_between(tzinfo=timezone.utc)
                for j in range(5):
                    trace = models.Trace(
                        project_rowid=project.id,
                        trace_id=token_hex(16),
                        start_time=start_time - timedelta(days=j),
                        end_time=datetime.now(timezone.utc),
                    )
                    session.add(trace)
                    await session.flush()
                    if i < num_projects // 2:
                        affected_projects[project.id].append(trace.id)
                    else:
                        unaffected_projects[project.id].append(trace.id)

        assert affected_projects, "Should be non-empty"
        assert unaffected_projects, "Should be non-empty"

        # Apply retention rule
        rule = MaxCountRule(max_count=1)
        async with db() as session:
            if scalar_subquery:
                await rule.delete_traces(
                    session,
                    sa.select(models.Project.id)
                    .where(models.Project.id.in_(affected_projects.keys()))
                    .scalar_subquery(),
                )
            else:
                await rule.delete_traces(session, affected_projects.keys())

        # Verify affected projects have only one trace
        async with db() as session:
            remaining_traces = await session.scalars(
                sa.select(models.Trace.id).where(
                    models.Trace.project_rowid.in_(affected_projects.keys())
                )
            )
        assert set(remaining_traces.all()) == set(
            traces[0] for traces in affected_projects.values()
        ), "Each affected project should retain only its most recent trace"

        # Verify unaffected projects are untouched
        async with db() as session:
            remaining_traces = await session.scalars(
                sa.select(models.Trace.id).where(
                    models.Trace.project_rowid.in_(unaffected_projects.keys())
                )
            )
        assert set(remaining_traces.all()) == set(
            chain.from_iterable(unaffected_projects.values())
        ), "Unaffected projects should retain all their traces"


class TestTraceRetentionRuleMaxDaysOrCountRule:
    """Test the MaxDaysOrCountRule which combines both max_days and max_count rules.

    This rule enforces two retention policies:
    1. Max Days: Traces older than max_days will be deleted
    2. Max Count: Only the most recent max_count traces will be kept

    The test verifies that:
    - Projects with traces older than max_days have all their traces deleted
    - Projects with more than max_count traces have only their most recent trace kept
    - Unaffected projects retain all their traces

    Note: The rule uses OR logic - a trace will be deleted if it is either:
    - Older than max_days OR
    - Beyond max_count for its project
    """

    @pytest.mark.parametrize("scalar_subquery", [True, False])
    async def test_delete_traces(
        self,
        scalar_subquery: bool,
        db: DbSessionFactory,
    ) -> None:
        # Setup test data
        affected_projects: defaultdict[int, list[int]] = defaultdict(list)
        unaffected_projects: defaultdict[int, list[int]] = defaultdict(list)
        old_projects: defaultdict[int, list[int]] = defaultdict(list)
        num_projects = 10  # half will be affected, half will be unaffected

        async with db() as session:
            # Create projects with traces of varying ages. Each affected project
            # should have one trace remaining after deletion.
            for i in range(num_projects):
                project = models.Project(name=token_hex(8))
                session.add(project)
                await session.flush()
                start_time = fake.date_time_between(start_date="-12h", tzinfo=timezone.utc)
                for j in range(5):
                    trace = models.Trace(
                        project_rowid=project.id,
                        trace_id=token_hex(16),
                        start_time=start_time - timedelta(days=j),
                        end_time=datetime.now(timezone.utc),
                    )
                    session.add(trace)
                    await session.flush()
                    if i < num_projects // 2:
                        affected_projects[project.id].append(trace.id)
                    else:
                        unaffected_projects[project.id].append(trace.id)

            # Create projects with old traces. Each affected project should have
            # no trace remaining after deletion.
            for i in range(num_projects):
                project = models.Project(name=token_hex(8))
                session.add(project)
                await session.flush()
                # Ensure all traces are older than max_days (2 days)
                start_time = fake.date_time_between(end_date="-3d", tzinfo=timezone.utc)
                for j in range(5):
                    trace = models.Trace(
                        project_rowid=project.id,
                        trace_id=token_hex(16),
                        start_time=start_time - timedelta(days=j),
                        end_time=datetime.now(timezone.utc),
                    )
                    session.add(trace)
                    await session.flush()
                    old_projects[project.id].append(trace.id)
                    if i < num_projects // 2:
                        affected_projects[project.id].append(trace.id)
                    else:
                        unaffected_projects[project.id].append(trace.id)

        assert affected_projects, "Should be non-empty"
        assert unaffected_projects, "Should be non-empty"

        # Apply retention rule
        rule = MaxDaysOrCountRule(max_days=2, max_count=1)
        async with db() as session:
            if scalar_subquery:
                await rule.delete_traces(
                    session,
                    sa.select(models.Project.id)
                    .where(models.Project.id.in_(affected_projects.keys()))
                    .scalar_subquery(),
                )
            else:
                await rule.delete_traces(session, affected_projects.keys())

        # Verify affected projects have only one trace
        async with db() as session:
            remaining_traces = await session.scalars(
                sa.select(models.Trace.id).where(
                    models.Trace.project_rowid.in_(affected_projects.keys())
                )
            )
        assert set(remaining_traces.all()) == set(
            traces[0] for traces in affected_projects.values()
        ) - set(chain.from_iterable(old_projects.values())), (
            "Each affected project should retain only its most recent trace and old projects should haveno trace remaining"
        )

        # Verify unaffected projects are untouched
        async with db() as session:
            remaining_traces = await session.scalars(
                sa.select(models.Trace.id).where(
                    models.Trace.project_rowid.in_(unaffected_projects.keys())
                )
            )
        assert set(remaining_traces.all()) == set(
            chain.from_iterable(unaffected_projects.values())
        ), "Unaffected projects should retain all their traces"


class TestTraceRetentionRule:
    @pytest.mark.parametrize(
        "rule_data,expected_type",
        [
            pytest.param(
                {"type": "max_days", "max_days": 30},
                MaxDaysRule,
                id="max_days_serialization",
            ),
            pytest.param(
                {"type": "max_count", "max_count": 100},
                MaxCountRule,
                id="max_count_serialization",
            ),
            pytest.param(
                {"type": "max_days_or_count", "max_days": 30, "max_count": 100},
                MaxDaysOrCountRule,
                id="max_days_or_count_serialization",
            ),
        ],
    )
    def test_discriminated_union_serialization_deserialization(
        self,
        rule_data: Dict[str, Any],
        expected_type: Type[Union[MaxDaysRule, MaxCountRule, MaxDaysOrCountRule]],
    ) -> None:
        """Test that rules can be serialized and deserialized correctly."""
        rule: TraceRetentionRule = TraceRetentionRule.model_validate(rule_data)
        assert isinstance(rule.root, expected_type)
        assert rule.model_dump() == rule_data


@pytest.mark.parametrize(
    "cron_expression, frozen_time, expected_time, comment",
    [
        pytest.param(
            "0 * * * *",
            "2023-01-01 14:30:00+00:00",
            "2023-01-01 15:00:00+00:00",
            "Every hour - next hour when current time has minutes > 0",
            id="every-hour-next",
        ),
        pytest.param(
            "0 * * * *",
            "2023-01-01 14:00:00+00:00",
            "2023-01-01 15:00:00+00:00",
            "Every hour - next hour when current time is exactly at the hour",
            id="every-hour-exact",
        ),
        pytest.param(
            "0 */2 * * *",
            "2023-01-01 13:15:00+00:00",
            "2023-01-01 14:00:00+00:00",
            "Every even hour with current time at odd hour",
            id="every-even-hour",
        ),
        pytest.param(
            "0 */2 * * *",
            "2023-01-01 14:15:00+00:00",
            "2023-01-01 16:00:00+00:00",
            "Every even hour with current time at even hour",
            id="every-even-hour-2",
        ),
        pytest.param(
            "0 9-17 * * 1-5",
            "2023-01-01 17:30:00+00:00",  # Sunday
            "2023-01-02 09:00:00+00:00",  # Monday
            "Business hours (9-17) on weekdays, starting from weekend",
            id="business-hours-weekend",
        ),
        pytest.param(
            "0 9-17 * * 1-5",
            "2023-01-02 08:30:00+00:00",  # Monday
            "2023-01-02 09:00:00+00:00",  # Monday
            "Business hours (9-17) on weekdays, before business hours",
            id="business-hours-before",
        ),
        pytest.param(
            "0 9-17 * * 1-5",
            "2023-01-02 13:30:00+00:00",  # Monday
            "2023-01-02 14:00:00+00:00",  # Monday
            "Business hours (9-17) on weekdays, during business hours",
            id="business-hours-during",
        ),
        pytest.param(
            "0 9-17 * * 1-5",
            "2023-01-02 17:30:00+00:00",  # Monday
            "2023-01-03 09:00:00+00:00",  # Tuesday
            "Business hours (9-17) on weekdays, after business hours",
            id="business-hours-after",
        ),
        pytest.param(
            "0 0,12 * * *",
            "2023-01-01 08:30:00+00:00",
            "2023-01-01 12:00:00+00:00",
            "Twice a day at midnight and noon, before noon",
            id="twice-daily-before-noon",
        ),
        pytest.param(
            "0 0,12 * * *",
            "2023-01-01 13:30:00+00:00",
            "2023-01-02 00:00:00+00:00",
            "Twice a day at midnight and noon, after noon",
            id="twice-daily-after-noon",
        ),
        pytest.param(
            "0 3 * * 0",
            "2023-01-02 13:30:00+00:00",  # Monday
            "2023-01-08 03:00:00+00:00",  # Sunday
            "3 AM on Sundays only, starting from Monday",
            id="sunday-3am",
        ),
    ],
)
def test_time_of_next_run(
    cron_expression: str,
    frozen_time: str,
    expected_time: str,
    comment: str,
) -> None:
    """
    Test the time_of_next_run function with various cron expressions.

    Args:
        cron_expression: The cron expression to test
        frozen_time: The time to freeze at for testing
        expected_time: The expected next run time
        comment: Description of the test case
    """
    with freeze_time(frozen_time):
        actual = _time_of_next_run(cron_expression)
        expected = datetime.fromisoformat(expected_time)
        assert actual == expected


@pytest.mark.parametrize(
    "cron_expression, expected_error_msg",
    [
        # Tests for invalid field count
        pytest.param(
            "0",
            "Invalid cron expression. Expected 5 fields",
            id="too-few-fields",
        ),
        pytest.param(
            "0 * * *",
            "Invalid cron expression. Expected 5 fields",
            id="missing-one-field",
        ),
        pytest.param(
            "0 * * * * *",
            "Invalid cron expression. Expected 5 fields",
            id="too-many-fields",
        ),
        # Tests for invalid minute field (must be 0)
        pytest.param(
            "1 * * * *",
            "Invalid cron expression. Minute field must be '0'.",
            id="non-zero-minute",
        ),
        pytest.param(
            "*/5 * * * *",
            "Invalid cron expression. Minute field must be '0'.",
            id="minute-with-step",
        ),
        pytest.param(
            "1-59 * * * *",
            "Invalid cron expression. Minute field must be '0'.",
            id="minute-range",
        ),
        # Tests for invalid day-of-month field (must be *)
        pytest.param(
            "0 * 1 * *",
            "Invalid cron expression. Day-of-month and month fields must be '*'.",
            id="specific-day-of-month",
        ),
        pytest.param(
            "0 * 1-15 * *",
            "Invalid cron expression. Day-of-month and month fields must be '*'.",
            id="day-of-month-range",
        ),
        pytest.param(
            "0 * */2 * *",
            "Invalid cron expression. Day-of-month and month fields must be '*'.",
            id="day-of-month-step",
        ),
        # Tests for invalid month field (must be *)
        pytest.param(
            "0 * * 1 *",
            "Invalid cron expression. Day-of-month and month fields must be '*'.",
            id="specific-month",
        ),
        pytest.param(
            "0 * * 1-6 *",
            "Invalid cron expression. Day-of-month and month fields must be '*'.",
            id="month-range",
        ),
        pytest.param(
            "0 * * */3 *",
            "Invalid cron expression. Day-of-month and month fields must be '*'.",
            id="month-step",
        ),
        # Tests for invalid value ranges
        pytest.param(
            "0 24 * * *",
            "Value 24 out of range (0-23)",
            id="hour-out-of-range-high",
        ),
        pytest.param(
            "0 -1 * * *",
            "Invalid range format: -1",
            id="hour-negative",
        ),
        pytest.param(
            "0 * * * 7",
            "Value 7 out of range (0-6)",
            id="day-of-week-out-of-range",
        ),
        pytest.param(
            "0 * * * -1",
            "Invalid range format: -1",
            id="day-of-week-negative",
        ),
        # Tests for invalid range formats
        pytest.param(
            "0 5-2 * * *",
            "Invalid range: 5-2 (start > end)",
            id="invalid-hour-range",
        ),
        pytest.param(
            "0 * * * 6-2",
            "Invalid range: 6-2 (start > end)",
            id="invalid-day-range",
        ),
        pytest.param(
            "0 a-b * * *",
            "Invalid range format: a-b",
            id="non-numeric-range",
        ),
        # Tests for invalid step values
        pytest.param(
            "0 */0 * * *",
            "Step value must be positive: 0",
            id="zero-step",
        ),
        pytest.param(
            "0 */-2 * * *",
            "Step value must be positive: -2",
            id="negative-step",
        ),
        pytest.param(
            "0 */a * * *",
            "Invalid step value: a",
            id="non-numeric-step",
        ),
        # Tests for invalid single values
        pytest.param(
            "0 a * * *",
            "Invalid value: a",
            id="non-numeric-hour",
        ),
        pytest.param(
            "0 * * * a",
            "Invalid value: a",
            id="non-numeric-day",
        ),
        # Tests for combined invalid formats
        pytest.param(
            "0 1-a * * *",
            "Invalid range format: 1-a",
            id="invalid-range-end",
        ),
        pytest.param(
            "0 a-5 * * *",
            "Invalid range format: a-5",
            id="invalid-range-start",
        ),
        pytest.param(
            "0 5-10/a * * *",
            "Invalid step value: a",
            id="invalid-step-in-range",
        ),
    ],
)
def test_invalid_cron_expressions(cron_expression: str, expected_error_msg: str) -> None:
    """
    Test that the time_of_next_run function correctly raises ValueErrors
    for invalid cron expressions.

    Args:
        cron_expression: An invalid cron expression
        expected_error_msg: The expected error message prefix
    """
    with pytest.raises(ValueError) as exc_info:
        _time_of_next_run(cron_expression)
    assert str(exc_info.value).startswith(expected_error_msg)
