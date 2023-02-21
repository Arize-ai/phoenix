from datetime import datetime
from functools import total_ordering
from typing import List, Optional

import strawberry


@strawberry.type
@total_ordering
class TimeSeriesDataPoint:
    """A data point in a time series"""

    """The timestamp of the data point"""
    timestamp: datetime

    """The value of the data point"""
    value: Optional[float]

    def __lt__(self, other: "TimeSeriesDataPoint") -> bool:
        return self.timestamp < other.timestamp


@strawberry.interface
class TimeSeries:
    """A collection of data points over time"""

    data: List[TimeSeriesDataPoint]
