import math
from datetime import datetime
from typing import Any, Iterable, Protocol

import pandas as pd
import strawberry

from .TimeSeries import TimeSeries, TimeSeriesDataPoint


@strawberry.type
class DataQualityTimeSeries(TimeSeries):
    """A time series of data quality metrics"""

    ...


class CanGetValue(Protocol):
    def get_value(self, result: Any) -> Any:
        ...


def to_gql_timeseries(
    df: pd.DataFrame, metric: CanGetValue, timestamps: Iterable[datetime]
) -> DataQualityTimeSeries:
    empty = pd.DataFrame()
    data = []
    for timestamp in timestamps:
        try:
            row = df.loc[timestamp, :]
        except KeyError:
            row = empty
        value = metric.get_value(row)
        data.append(
            TimeSeriesDataPoint(
                timestamp=timestamp,
                value=None if math.isnan(value) else value,
            )
        )
    return DataQualityTimeSeries(data=sorted(data))
