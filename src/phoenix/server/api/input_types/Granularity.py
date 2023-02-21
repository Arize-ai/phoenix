from datetime import datetime, timedelta
from itertools import accumulate, repeat, takewhile
from typing import Generator

import strawberry
from typing_extensions import Annotated

from phoenix.server.api.input_types.TimeRange import TimeRange


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

    evaluation_window_minutes: Annotated[
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
    sampling_interval_minutes: Annotated[
        int,
        strawberry.argument(
            description="sampling_interval is the time interval between each "
            "point in the time-series. All points in the time-series are "
            "separated by the same length of time. When sampling_interval is "
            "omitted, it will be set to equal evaluation_window by default.",
        ),
    ]


def to_timestamps(
    time_range: TimeRange, granularity: Granularity
) -> Generator[datetime, None, None]:
    yield from (
        takewhile(
            lambda t: time_range.start < t,  # type: ignore
            accumulate(
                repeat(-timedelta(minutes=granularity.sampling_interval_minutes)),
                initial=time_range.end,
            ),
        )
    )
