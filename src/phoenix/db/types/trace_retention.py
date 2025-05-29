from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Iterable, Literal, Optional, Union

import sqlalchemy as sa
from pydantic import AfterValidator, BaseModel, Field, RootModel
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.utilities import hour_of_week


class _MaxDays(BaseModel):
    max_days: Annotated[float, Field(ge=0)]

    @property
    def max_days_filter(self) -> sa.ColumnElement[bool]:
        if self.max_days <= 0:
            return sa.literal(False)
        from phoenix.db.models import Trace

        return Trace.start_time < datetime.now(timezone.utc) - timedelta(days=self.max_days)


class _MaxCount(BaseModel):
    max_count: Annotated[int, Field(ge=0)]

    @property
    def max_count_filter(self) -> sa.ColumnElement[bool]:
        if self.max_count <= 0:
            return sa.literal(False)
        from phoenix.db.models import Trace

        return Trace.start_time < (
            sa.select(Trace.start_time)
            .order_by(Trace.start_time.desc())
            .offset(self.max_count - 1)
            .limit(1)
            .scalar_subquery()
        )


class MaxDaysRule(_MaxDays, BaseModel):
    type: Literal["max_days"] = "max_days"

    def __bool__(self) -> bool:
        return self.max_days > 0

    async def delete_traces(
        self,
        session: AsyncSession,
        project_rowids: Union[Iterable[int], sa.ScalarSelect[int]],
    ) -> set[int]:
        if self.max_days <= 0:
            return set()
        from phoenix.db.models import Trace

        stmt = (
            sa.delete(Trace)
            .where(Trace.project_rowid.in_(project_rowids))
            .where(self.max_days_filter)
            .returning(Trace.project_rowid)
        )
        return set(await session.scalars(stmt))


class MaxCountRule(_MaxCount, BaseModel):
    type: Literal["max_count"] = "max_count"

    def __bool__(self) -> bool:
        return self.max_count > 0

    async def delete_traces(
        self,
        session: AsyncSession,
        project_rowids: Union[Iterable[int], sa.ScalarSelect[int]],
    ) -> set[int]:
        if self.max_count <= 0:
            return set()
        from phoenix.db.models import Trace

        stmt = (
            sa.delete(Trace)
            .where(Trace.project_rowid.in_(project_rowids))
            .where(self.max_count_filter)
            .returning(Trace.project_rowid)
        )
        return set(await session.scalars(stmt))


class MaxDaysOrCountRule(_MaxDays, _MaxCount, BaseModel):
    type: Literal["max_days_or_count"] = "max_days_or_count"

    def __bool__(self) -> bool:
        return self.max_days > 0 or self.max_count > 0

    async def delete_traces(
        self,
        session: AsyncSession,
        project_rowids: Union[Iterable[int], sa.ScalarSelect[int]],
    ) -> set[int]:
        if self.max_days <= 0 and self.max_count <= 0:
            return set()
        from phoenix.db.models import Trace

        stmt = (
            sa.delete(Trace)
            .where(Trace.project_rowid.in_(project_rowids))
            .where(sa.or_(self.max_days_filter, self.max_count_filter))
            .returning(Trace.project_rowid)
        )
        return set(await session.scalars(stmt))


class TraceRetentionRule(RootModel[Union[MaxDaysRule, MaxCountRule, MaxDaysOrCountRule]]):
    root: Annotated[
        Union[MaxDaysRule, MaxCountRule, MaxDaysOrCountRule], Field(discriminator="type")
    ]

    def __bool__(self) -> bool:
        return bool(self.root)

    async def delete_traces(
        self,
        session: AsyncSession,
        project_rowids: Union[Iterable[int], sa.ScalarSelect[int]],
    ) -> set[int]:
        return await self.root.delete_traces(session, project_rowids)


def _time_of_next_run(
    cron_expression: str,
    after: Optional[datetime] = None,
) -> datetime:
    """
    Parse a cron expression and calculate the UTC datetime of the next run.
    Only processes hour, and day of week fields; day-of-month and
    month fields must be '*'; minute field must be 0.

    Args:
        cron_expression (str): Standard cron expression with 5 fields:
            minute hour day-of-month month day-of-week
            (minute must be '0'; day-of-month and month must be '*')
        after: Optional[datetime]: The datetime to start searching from. If None,
            the current time is used. Must be timezone-aware.

    Returns:
        datetime: The datetime of the next run. Timezone is UTC.

    Raises:
        ValueError: If the expression has non-wildcard values for day-of-month or month, if the
            minute field is not '0', or if no match is found within the next 7 days (168 hours).
    """
    fields: list[str] = cron_expression.strip().split()
    if len(fields) != 5:
        raise ValueError(
            "Invalid cron expression. Expected 5 fields "
            "(minute hour day-of-month month day-of-week)."
        )
    if fields[0] != "0":
        raise ValueError("Invalid cron expression. Minute field must be '0'.")
    if fields[2] != "*" or fields[3] != "*":
        raise ValueError("Invalid cron expression. Day-of-month and month fields must be '*'.")
    hours: set[int] = _parse_field(fields[1], 0, 23)
    # Parse days of week (0-6, where 0 is Sunday)
    days_of_week: set[int] = _parse_field(fields[4], 0, 6)
    # Convert to Python's weekday format (0-6, where 0 is Monday)
    # Sunday (0 in cron) becomes 6 in Python's weekday()
    python_days_of_week = {(day_of_week + 6) % 7 for day_of_week in days_of_week}
    t = after.replace(tzinfo=timezone.utc) if after else datetime.now(timezone.utc)
    t = t.replace(minute=0, second=0, microsecond=0)
    for _ in range(168):  # Check up to 7 days (168 hours)
        t += timedelta(hours=1)
        if t.hour in hours and t.weekday() in python_days_of_week:
            return t
    raise ValueError("No matching execution time found within the next 7 days.")


class TraceRetentionCronExpression(RootModel[str]):
    root: Annotated[str, AfterValidator(lambda x: (_time_of_next_run(x), x)[1])]

    def get_hour_of_prev_run(self) -> int:
        """
        Calculate the hour of the previous run before now.

        Returns:
            int: The hour of the previous run (0-167), where 0 is midnight Sunday UTC.
        """
        after = datetime.now(timezone.utc) - timedelta(hours=1)
        return hour_of_week(_time_of_next_run(self.root, after))


def _parse_field(field: str, min_val: int, max_val: int) -> set[int]:
    """
    Parse a cron field and return the set of matching values.

    Args:
        field (str): The cron field to parse
        min_val (int): Minimum allowed value for this field
        max_val (int): Maximum allowed value for this field

    Returns:
        set[int]: Set of all valid values represented by the field expression

    Raises:
        ValueError: If the field contains invalid values or formats
    """
    if field == "*":
        return set(range(min_val, max_val + 1))
    values: set[int] = set()
    for part in field.split(","):
        if "/" in part:
            # Handle steps
            range_part, step_str = part.split("/")
            try:
                step = int(step_str)
            except ValueError:
                raise ValueError(f"Invalid step value: {step_str}")
            if step <= 0:
                raise ValueError(f"Step value must be positive: {step}")
            if range_part == "*":
                start, end = min_val, max_val
            elif "-" in range_part:
                try:
                    start_str, end_str = range_part.split("-")
                    start, end = int(start_str), int(end_str)
                except ValueError:
                    raise ValueError(f"Invalid range format: {range_part}")
                if start < min_val or end > max_val:
                    raise ValueError(
                        f"Range {start}-{end} outside allowed values ({min_val}-{max_val})"
                    )
                if start > end:
                    raise ValueError(f"Invalid range: {start}-{end} (start > end)")
            else:
                try:
                    start = int(range_part)
                except ValueError:
                    raise ValueError(f"Invalid value: {range_part}")
                if start < min_val or start > max_val:
                    raise ValueError(f"Value {start} out of range ({min_val}-{max_val})")
                end = max_val
            values.update(range(start, end + 1, step))
        elif "-" in part:
            # Handle ranges
            try:
                start_str, end_str = part.split("-")
                start, end = int(start_str), int(end_str)
            except ValueError:
                raise ValueError(f"Invalid range format: {part}")
            if start < min_val or end > max_val:
                raise ValueError(
                    f"Range {start}-{end} outside allowed values ({min_val}-{max_val})"
                )
            if start > end:
                raise ValueError(f"Invalid range: {start}-{end} (start > end)")
            values.update(range(start, end + 1))
        else:
            # Handle single values
            try:
                value = int(part)
            except ValueError:
                raise ValueError(f"Invalid value: {part}")
            if value < min_val or value > max_val:
                raise ValueError(f"Value {value} out of range ({min_val}-{max_val})")
            values.add(value)
    return values
