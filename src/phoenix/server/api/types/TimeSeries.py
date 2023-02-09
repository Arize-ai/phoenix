from datetime import datetime
from typing import List, Optional

import strawberry


@strawberry.type
class TimeSeriesDataPoint:
    """A data point in a time series"""

    """ the datetime of the data point"""
    timestamp: datetime

    """ the datetime of the data point"""
    value: Optional[float]


@strawberry.interface
class TimeSeries:
    """A collection of data points over time"""

    data: List[TimeSeriesDataPoint]
