from datetime import datetime, timedelta
from typing import Optional

import strawberry

from phoenix.datasets import Dataset
from phoenix.metrics.timeseries import TimeseriesParams


@strawberry.input
class Granularity:
    """
    Granularity specifies the frequency of points in a time-series and the
    duration of time (i.e. evaluation window) by which data is aggregated for
    each data point. By convention all time intervals are right-open intervals,
    i.e. the end instant of the evaluation window is excluded from the interval.
    As a matter of standardization, each point in a time-series aggregates data
    corresponding to an interval of time (i.e. the evaluation window) ending at
    the point's timestamp, and each time-series enumerates its points starting
    from the end-time of the TimeRange.
    """

    evaluation_window_in_minutes: int
    """
    evaluation_window is the length of a sub-interval of time by which the
    data aggregations are grouped. Each point in a time-series will have the
    same evaluation_window, but the evaluation_window for each point can
    overlap in real time. For example, when the points are 24 hours apart but
    the eval window is 72 hours, it means that each point in the time-series
    is aggregating 72 hours worth of data ending at the point's timestamp.
    """
    sampling_interval_in_minutes: Optional[int]
    """
    sampling_interval is the time interval between each point in the time-series.
    All points in the time-series are separated by the same length of time. When
    sampling_interval is omitted, it will be set to equal evaluation_window by
    default.
    """


@strawberry.input
class TimeRange:
    """
    TimeRange specifies the interval of time by which data is filtered. By
    convention, the end instant is excluded from the interval, i.e. TimeRange is
    a right-open interval.
    """

    start: datetime
    end: datetime
    """The end instant is excluded from the TimeRange interval."""
    granularity: Optional[Granularity]
    """Specifies the frequency and evaluation window of the points in the time
    series."""

    def to_timeseries_params(self) -> TimeseriesParams:
        return TimeseriesParams(
            start=self.start,
            end=self.end,
            evaluation_window=timedelta(minutes=self.granularity.evaluation_window_in_minutes)
            if self.granularity
            else None,
            sampling_interval=timedelta(minutes=self.granularity.sampling_interval_in_minutes)
            if self.granularity and self.granularity.sampling_interval_in_minutes
            else None,
        )

    def is_valid(self) -> bool:
        return self.start < self.end


def ensure_time_range(dataset: Dataset, time_range: Optional[TimeRange] = None) -> TimeRange:
    return (
        time_range
        if time_range
        else TimeRange(
            start=dataset.start_time,
            end=dataset.end_time,
            granularity=None,
        )
    )
