from datetime import datetime, timedelta
from itertools import accumulate, repeat, takewhile
from typing import Generator, Optional

import strawberry
from typing_extensions import Annotated

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

    evaluation_window_in_minutes: Annotated[
        int,
        strawberry.argument(
            description="evaluation_window is the length of a sub-interval of "
            "time by which the data aggregations are grouped. Each point in a "
            "time-series will have the same evaluation_window, but the "
            "evaluation_window for each point can overlap in real time. For "
            "example, when the points are 24 hours apart but the eval window is "
            "72 hours, it means that each point in the time-series is aggregating "
            "72 hours worth of data ending at the point's timestamp.",
        ),
    ]
    sampling_interval_in_minutes: Annotated[
        Optional[int],
        strawberry.argument(
            description="sampling_interval is the time interval between each "
            "point in the time-series. All points in the time-series are "
            "separated by the same length of time. When sampling_interval is "
            "omitted, it will be set to equal evaluation_window by default.",
        ),
    ] = None


@strawberry.input
class TimeRange:
    """
    TimeRange specifies the interval of time by which data is filtered. By
    convention, the end instant is excluded from the interval, i.e. TimeRange is
    a right-open interval.
    """

    start: datetime
    end: Annotated[
        datetime,
        strawberry.argument(
            description="The end instant is excluded from the TimeRange interval.",
        ),
    ]
    granularity: Annotated[
        Optional[Granularity],
        strawberry.argument(
            description="Specifies the frequency and evaluation window of the "
            "points in the time series.",
        ),
    ]

    def evaluation_window(self) -> timedelta:
        if self.granularity:
            return timedelta(minutes=self.granularity.evaluation_window_in_minutes)
        return self.end - self.start

    def sampling_interval(self) -> timedelta:
        if self.granularity and self.granularity.sampling_interval_in_minutes:
            return timedelta(minutes=self.granularity.sampling_interval_in_minutes)
        return self.evaluation_window()

    def to_timeseries_params(self) -> TimeseriesParams:
        return TimeseriesParams(
            start_time=self.start,
            end_time=self.end,
            evaluation_window=self.evaluation_window(),
            sampling_interval=self.sampling_interval(),
        )

    def to_timestamps(self) -> Generator[datetime, None, None]:
        yield from (
            takewhile(
                lambda t: self.start < t,  # type: ignore
                accumulate(repeat(-self.sampling_interval()), initial=self.end),
            )
        )

    def is_valid(self) -> bool:
        return self.start < self.end


def ensure_time_range(dataset: Dataset, time_range: Optional[TimeRange] = None) -> TimeRange:
    return time_range or TimeRange(
        start=dataset.start_time,
        end=dataset.end_time + timedelta(microseconds=1),  # end instant is exclusive
        granularity=None,
    )
