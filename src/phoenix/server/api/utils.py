from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import delete

from phoenix.db import models
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.Granularity import Granularity
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.types import DbSessionFactory


async def delete_projects(
    db: DbSessionFactory,
    *project_names: str,
) -> list[int]:
    if not project_names:
        return []
    stmt = (
        delete(models.Project)
        .where(models.Project.name.in_(set(project_names)))
        .returning(models.Project.id)
    )
    async with db() as session:
        return list(await session.scalars(stmt))


async def delete_traces(
    db: DbSessionFactory,
    *trace_ids: str,
) -> list[int]:
    if not trace_ids:
        return []
    stmt = (
        delete(models.Trace)
        .where(models.Trace.trace_id.in_(set(trace_ids)))
        .returning(models.Trace.id)
    )
    async with db() as session:
        return list(await session.scalars(stmt))


def get_parameters_for_simple_time_series(
    time_range: Optional[TimeRange],
    granularity: Optional[Granularity],
) -> tuple[datetime, int]:
    """Calculate time series parameters for simple time series queries.

    This function determines the appropriate stop time and interval for time series
    data queries based on the provided time range and granularity settings. It handles
    various edge cases and provides sensible defaults when parameters are not specified.

    Args:
        time_range: Optional time range specifying start and/or end times.
            - If both start and end are provided, uses the end time
            - If only start is provided, calculates end time based on current time and interval
            - If neither is provided, uses current time
        granularity: Optional granularity settings for the time series.
            - If None, defaults to hourly intervals (3600 seconds)
            - If provided, evaluation_window_minutes must equal sampling_interval_minutes
            - sampling_interval_minutes is used to calculate interval_seconds

    Returns:
        tuple[datetime, int]: A tuple containing:
            - stop_time: The calculated stop time, rounded to the nearest minute
            - interval_seconds: The interval in seconds between time series points

    Raises:
        BadRequest: If granularity is provided but evaluation_window_minutes does not
            equal sampling_interval_minutes.

    Examples:
        >>> # Default hourly granularity with explicit time range
        >>> time_range = TimeRange(start=dt(2023, 1, 1, 12, 0), end=dt(2023, 1, 1, 13, 0))
        >>> stop_time, interval = get_parameters_for_simple_time_series(time_range, None)
        >>> print(f"Stop: {stop_time}, Interval: {interval}s")
        Stop: 2023-01-01 13:00:00+00:00, Interval: 3600s

        >>> # Custom granularity
        >>> granularity = Granularity(evaluation_window_minutes=30, sampling_interval_minutes=30)
        >>> stop_time, interval = get_parameters_for_simple_time_series(time_range, granularity)
        >>> print(f"Stop: {stop_time}, Interval: {interval}s")
        Stop: 2023-01-01 13:00:00+00:00, Interval: 1800s
    """
    if not granularity:
        interval_seconds = 3600  # Default to hourly granularity
    else:
        if (
            granularity.evaluation_window_minutes
            and granularity.evaluation_window_minutes != granularity.sampling_interval_minutes
        ):
            raise BadRequest("evaluation_window_minutes must equal sampling_interval_minutes")
        if granularity.sampling_interval_minutes <= 0:
            raise BadRequest("sampling_interval_minutes must be positive")
        interval_seconds = granularity.sampling_interval_minutes * 60

    # Calculate the end time based on the time range
    if time_range and time_range.end:
        stop_time = time_range.end
    elif time_range and time_range.start:
        diff = datetime.now(tz=timezone.utc) - time_range.start
        stop_time = time_range.start + timedelta(
            seconds=(1 + diff.total_seconds() // interval_seconds) * interval_seconds
        )
    else:
        stop_time = datetime.now(tz=timezone.utc)

    # Round the stop time to the nearest minute
    return stop_time.replace(second=0, microsecond=0), interval_seconds
