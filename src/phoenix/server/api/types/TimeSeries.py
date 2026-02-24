from datetime import datetime
from functools import total_ordering
from typing import Optional

import strawberry

from phoenix.server.api.interceptor import GqlValueMediator


@strawberry.type
@total_ordering
class TimeSeriesDataPoint:
    """A data point in a time series"""

    """The timestamp of the data point"""
    timestamp: datetime

    """The value of the data point"""
    value: Optional[float] = strawberry.field(default=GqlValueMediator())

    def __lt__(self, other: "TimeSeriesDataPoint") -> bool:  # type: ignore
        return self.timestamp < other.timestamp


@strawberry.interface
class TimeSeries:
    """A collection of data points over time"""

    data: list[TimeSeriesDataPoint]
