from __future__ import annotations

import codecs
import sys
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


def no_emojis_on_windows(text: str) -> str:
    if sys.platform.startswith("win"):
        return codecs.encode(text, "ascii", errors="ignore").decode("ascii").strip()
    return text
