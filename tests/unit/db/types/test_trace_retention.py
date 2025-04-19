from collections import defaultdict
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Dict, Type, Union

import pytest
import sqlalchemy as sa
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
            pytest.param(
                10,
                "traces.start_time < (SELECT traces.start_time FROM traces "
                "ORDER BY traces.start_time DESC LIMIT 1 OFFSET 9)",
                id="ten_count",
            ),
        ],
    )
    def test_filter(self, max_count: int, expected: str) -> None:
        """Test that max_count_filter generates correct SQL query."""
        rule: _MaxCount = _MaxCount(max_count=max_count)
        actual = str(rule.max_count_filter.compile(compile_kwargs={"literal_binds": True}))
        actual = " ".join(actual.split())
        assert actual == expected


class TestTraceRetentionRuleMaxDays:
    async def test_delete_traces(self, db: DbSessionFactory) -> None:
        projects: defaultdict[int, list[int]] = defaultdict(list)
        start_time = datetime.now(timezone.utc)
        async with db() as session:
            for _ in range(5):
                project = models.Project(name=token_hex(8))
                session.add(project)
                await session.flush()
                for i in range(5):
                    trace = models.Trace(
                        project_rowid=project.id,
                        trace_id=token_hex(16),
                        start_time=start_time - timedelta(days=i),
                        end_time=datetime.now(timezone.utc),
                    )
                    session.add(trace)
                    await session.flush()
                    projects[project.id].append(trace.id)
        rule = MaxDaysRule(max_days=1)
        async with db() as session:
            await rule.delete_traces(session, projects.keys())
        async with db() as session:
            remaining_traces = await session.scalars(
                sa.select(models.Trace.id).where(models.Trace.project_rowid.in_(projects.keys()))
            )
        # only one trace remains per project
        assert sorted(remaining_traces.all()) == sorted(traces[0] for traces in projects.values())


class TestTraceRetentionRuleMaxCount:
    async def test_delete_traces(self, db: DbSessionFactory) -> None:
        projects: defaultdict[int, list[int]] = defaultdict(list)
        start_time = datetime.now(timezone.utc)
        async with db() as session:
            for _ in range(5):
                project = models.Project(name=token_hex(8))
                session.add(project)
                await session.flush()
                for i in range(5):
                    trace = models.Trace(
                        project_rowid=project.id,
                        trace_id=token_hex(16),
                        start_time=start_time - timedelta(days=i),
                        end_time=datetime.now(timezone.utc),
                    )
                    session.add(trace)
                    await session.flush()
                    projects[project.id].append(trace.id)
        rule = MaxCountRule(max_count=1)
        async with db() as session:
            await rule.delete_traces(session, projects.keys())
        async with db() as session:
            remaining_traces = await session.scalars(
                sa.select(models.Trace.id).where(models.Trace.project_rowid.in_(projects.keys()))
            )
        # only one trace remains per project
        assert sorted(remaining_traces.all()) == sorted(traces[0] for traces in projects.values())


class TestTraceRetentionRule:
    @pytest.mark.parametrize(
        "rule_data,expected_type",
        [
            pytest.param(
                {"type": "max_days", "max_days": 30}, MaxDaysRule, id="max_days_serialization"
            ),
            pytest.param(
                {"type": "max_count", "max_count": 100}, MaxCountRule, id="max_count_serialization"
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
