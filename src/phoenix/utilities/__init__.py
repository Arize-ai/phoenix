from __future__ import annotations

from datetime import datetime


def hour_of_week(dt: datetime) -> int:
    """
    Convert a datetime object to hour of week (0-167) where 0 is midnight Sunday UTC.

    Args:
        dt (datetime): The datetime to convert (assumed to be in UTC)

    Returns:
        int: Hour of week (0-167)
    """
    # 0 is Monday in Python, so we need to adjust
    weekday = (dt.weekday() + 1) % 7
    return (weekday * 24) + dt.hour
