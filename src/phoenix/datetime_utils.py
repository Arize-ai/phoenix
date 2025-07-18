from datetime import datetime, timedelta, timezone, tzinfo
from typing import Any, Iterator, Literal, Optional, cast

import pandas as pd
import pytz
from pandas import Timestamp, to_datetime
from pandas.core.dtypes.common import (
    is_datetime64_any_dtype,
    is_datetime64tz_dtype,
    is_numeric_dtype,
    is_object_dtype,
)
from typing_extensions import assert_never

_LOCAL_TIMEZONE = datetime.now(timezone.utc).astimezone().tzinfo


def local_now() -> datetime:
    return datetime.now(timezone.utc).astimezone(tz=_LOCAL_TIMEZONE)


def normalize_datetime(
    dt: Optional[datetime],
    tz: Optional[tzinfo] = None,
) -> Optional[datetime]:
    """
    If the input datetime is timezone-naive, it is localized as local timezone
    unless tzinfo is specified.
    """
    if not isinstance(dt, datetime):
        return None
    if not is_timezone_aware(dt):
        dt = dt.replace(tzinfo=tz if tz else _LOCAL_TIMEZONE)
    return dt.astimezone(timezone.utc)


def normalize_timestamps(
    timestamps: "pd.Series[Any]",
) -> "pd.Series[Timestamp]":
    """
    If the input timestamps contains a Unix or datetime timestamp or ISO8601
    timestamp strings column, it is converted to UTC timezone-aware timestamp.
    If a timestamp is timezone-naive, it is localized as per local timezone
    and then converted to UTC.
    """
    if is_numeric_dtype(timestamps):
        return to_datetime(timestamps, unit="s", utc=True)
    if is_datetime64tz_dtype(timestamps):
        return timestamps.dt.tz_convert(pytz.utc)
    if is_datetime64_any_dtype(timestamps):
        return timestamps.dt.tz_localize(
            datetime.now().astimezone().tzinfo,
        ).dt.tz_convert(
            timezone.utc,
        )
    if is_object_dtype(timestamps):
        timestamps = to_datetime(timestamps)
        if timestamps.dt.tz is None:
            timestamps = timestamps.dt.tz_localize(
                datetime.now().astimezone().tzinfo,
            )
        return timestamps.dt.tz_convert(
            timezone.utc,
        )
    raise ValueError(
        "When provided, input timestamp column must have numeric or datetime dtype, "
        f"but found {timestamps.dtype} instead."
    )


def floor_to_minute(dt: datetime) -> datetime:
    """Floor datetime to the minute by taking a round-trip through string
    format because there isn't always an available function to strip the
    nanoseconds if present."""
    try:
        dt_as_string = dt.astimezone(
            timezone.utc,
        ).strftime(
            MINUTE_DATETIME_FORMAT,
        )
    except ValueError:
        # NOTE: as of Python 3.8.16, pandas 1.5.3:
        # >>> isinstance(pd.NaT, datetime.datetime)
        # True
        return cast(datetime, pd.NaT)
    return datetime.strptime(
        dt_as_string,
        MINUTE_DATETIME_FORMAT,
    ).astimezone(
        timezone.utc,
    )


MINUTE_DATETIME_FORMAT = "%Y-%m-%dT%H:%M:00%z"


def right_open_time_range(
    min_time: Optional[datetime],
    max_time: Optional[datetime],
) -> tuple[Optional[datetime], Optional[datetime]]:
    """
    First adds one minute to `max_time`, because time intervals are right
    open and one minute is the smallest interval allowed, then rounds down
    the times to the nearest minute.
    """
    return (
        floor_to_minute(min_time) if min_time else None,
        floor_to_minute(max_time + timedelta(minutes=1)) if max_time else None,
    )


def is_timezone_aware(dt: datetime) -> bool:
    """
    Returns True if the datetime is timezone-aware, False otherwise.
    """
    return dt.tzinfo is not None and dt.tzinfo.utcoffset(dt) is not None


def get_timestamp_range(
    start_time: datetime,
    end_time: datetime,
    stride: Literal["minute", "hour", "day", "week", "month", "year"] = "minute",
    utc_offset_minutes: int = 0,
) -> Iterator[datetime]:
    """
    Generate a sequence of datetime objects at regular intervals between start and end times.

    This function creates time intervals by rounding down the start time to the nearest
    stride boundary in the specified timezone, then yielding timestamps at regular
    intervals until reaching the end time. All returned timestamps are in UTC.

    Args:
        start_time: The starting datetime (inclusive after rounding down to stride boundary).
                   Must be timezone-aware.
        end_time: The ending datetime (exclusive). Must be timezone-aware.
        stride: The interval between generated timestamps. Options:
               - "minute": Generate timestamps every minute
               - "hour": Generate timestamps every hour
               - "day": Generate timestamps every day at midnight
               - "week": Generate timestamps every week at Monday midnight
               - "month": Generate timestamps on the 1st of each month at midnight
               - "year": Generate timestamps on January 1st of each year at midnight
        utc_offset_minutes: Timezone offset in minutes from UTC. Used to determine
                           the correct stride boundaries in local time. Positive values
                           are east of UTC, negative values are west of UTC.

    Returns:
        Iterator of datetime objects in UTC timezone, spaced at the specified stride
        interval. The first timestamp is rounded down to the nearest stride boundary
        in the local timezone (considering utc_offset_minutes).

    Examples:
        >>> from datetime import datetime, timezone
        >>> start = datetime(2024, 1, 1, 12, 30, 45, tzinfo=timezone.utc)
        >>> end = datetime(2024, 1, 1, 12, 33, 0, tzinfo=timezone.utc)
        >>> list(get_timestamp_range(start, end, "minute"))
        [datetime(2024, 1, 1, 12, 30, tzinfo=timezone.utc),
         datetime(2024, 1, 1, 12, 31, tzinfo=timezone.utc),
         datetime(2024, 1, 1, 12, 32, tzinfo=timezone.utc)]

        >>> # Week stride rounds down to Monday
        >>> start = datetime(2024, 1, 10, 12, 0, tzinfo=timezone.utc)  # Wednesday
        >>> end = datetime(2024, 1, 22, 0, 0, tzinfo=timezone.utc)
        >>> list(get_timestamp_range(start, end, "week"))
        [datetime(2024, 1, 8, 0, 0, tzinfo=timezone.utc),   # Monday
         datetime(2024, 1, 15, 0, 0, tzinfo=timezone.utc)]  # Next Monday

    Note:
        - If end_time <= start_time (after rounding), returns an empty iterator
        - Week intervals always start on Monday (weekday 0)
        - Month intervals handle variable month lengths correctly including leap years
        - The function works in local timezone for stride calculations but returns UTC
    """
    if not is_timezone_aware(start_time) or not is_timezone_aware(end_time):
        raise ValueError("start_time and end_time must be timezone-aware")

    # Apply UTC offset to work in local timezone
    offset_delta = timedelta(minutes=utc_offset_minutes)
    local_start_time = start_time + offset_delta

    # round down start_time to the nearest stride in local timezone
    if stride == "minute":
        t = local_start_time.replace(second=0, microsecond=0)
    elif stride == "hour":
        t = local_start_time.replace(minute=0, second=0, microsecond=0)
    elif stride == "day":
        t = local_start_time.replace(hour=0, minute=0, second=0, microsecond=0)
    elif stride == "week":
        # Round down to the beginning of the week (Monday)
        days_since_monday = local_start_time.weekday()
        t = local_start_time.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(
            days=days_since_monday
        )
    elif stride == "month":
        t = local_start_time.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif stride == "year":
        t = local_start_time.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        assert_never(stride)

    # Convert back to UTC for comparisons and yielding
    local_end_time = end_time + offset_delta

    while t < local_end_time:
        # Yield timestamp converted back to UTC
        yield t - offset_delta
        if stride == "minute":
            t += timedelta(minutes=1)
        elif stride == "hour":
            t += timedelta(hours=1)
        elif stride == "day":
            t += timedelta(days=1)
        elif stride == "week":
            t += timedelta(weeks=1)
        elif stride == "month":
            next_month = t.month % 12 + 1
            next_year = t.year + (t.month // 12)
            t = t.replace(
                year=next_year, month=next_month, day=1, hour=0, minute=0, second=0, microsecond=0
            )
        elif stride == "year":
            t = t.replace(
                year=t.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0
            )
        else:
            assert_never(stride)
