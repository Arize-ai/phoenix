from datetime import datetime
from typing import NamedTuple


class TimeRange(NamedTuple):
    start: datetime
    stop: datetime
