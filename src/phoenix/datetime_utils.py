from datetime import datetime, timedelta, timezone, tzinfo
from typing import Any, Optional, Tuple, cast

import pandas as pd
import pytz
from pandas import Timestamp, to_datetime
from pandas.core.dtypes.common import (
    is_datetime64_any_dtype,
    is_datetime64tz_dtype,
    is_numeric_dtype,
    is_object_dtype,
)

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
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
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
) -> Tuple[Optional[datetime], Optional[datetime]]:
    """
    First adds one minute to `max_time`, because time intervals are right
    open and one minute is the smallest interval allowed, then rounds down
    the times to the nearest minute.
    """
    return (
        floor_to_minute(min_time) if min_time else None,
        floor_to_minute(max_time + timedelta(minutes=1)) if max_time else None,
    )
