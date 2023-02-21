import math
from datetime import datetime
from typing import Iterable, cast

import pandas as pd
import strawberry

from phoenix.metrics.mixins import Metric

from .TimeSeries import TimeSeries, TimeSeriesDataPoint


@strawberry.type
class DataQualityTimeSeries(TimeSeries):
    """A time series of data quality metrics"""

    ...


def to_gql_timeseries(
    df: pd.DataFrame, metric: Metric, timestamps: Iterable[datetime]
) -> DataQualityTimeSeries:
    data = []
    for timestamp in timestamps:
        try:
            row = df.iloc[cast(int, df.index.get_loc(timestamp)), :].to_dict()
        except KeyError:
            row = {}
        value = metric.get_value(row)
        data.append(
            TimeSeriesDataPoint(
                timestamp=timestamp,
                value=None if math.isnan(value) else value,
            )
        )
    return DataQualityTimeSeries(data=sorted(data))
