from datetime import datetime, timedelta, timezone
from functools import partial
from itertools import accumulate, repeat
from typing import Callable, Iterable, Iterator, Tuple, cast

import pandas as pd
from typing_extensions import TypeAlias

from phoenix.metrics import Metric, multi_calculate


def timeseries(
    *,
    start_time: datetime,
    end_time: datetime,
    evaluation_window: timedelta,
    sampling_interval: timedelta,
) -> Callable[..., pd.DataFrame]:
    """
    Returns an aggregator for use by pandas.DataFrame.pipe() in conjunction
    with a list of Metrics to return a final time-series output in the form
    of a pandas.DataFrame where the row index is timestamp and each column
    is identified by each Metric's ID. Apply each metric's get_value() on
    the rows to extract the corresponding metric output value.
    """

    return partial(
        _aggregator,
        start_time=start_time,
        end_time=end_time,
        evaluation_window=evaluation_window,
        sampling_interval=sampling_interval,
    )


StartIndex: TypeAlias = int
StopIndex: TypeAlias = int


def row_interval_from_sorted_time_index(
    time_index: pd.DatetimeIndex,
    time_start: datetime,
    time_stop: datetime,
) -> Tuple[StartIndex, StopIndex]:
    """
    Returns end exclusive time slice from sorted index.
    """
    return cast(
        Tuple[StartIndex, StopIndex],
        time_index.searchsorted((time_start, time_stop)),
    )


def _aggregator(
    dataframe: pd.DataFrame,
    *,
    metrics: Iterable[Metric],
    start_time: datetime,
    end_time: datetime,
    evaluation_window: timedelta,
    sampling_interval: timedelta,
) -> pd.DataFrame:
    """
    Calls groupby on the dataframe and apply metric calculations on each group.
    """
    calcs = tuple(metrics)
    return pd.concat(
        _results(
            calcs=calcs,
            dataframe=dataframe,
            start_time=start_time,
            end_time=end_time,
            evaluation_window=evaluation_window,
            sampling_interval=sampling_interval,
        ),
        verify_integrity=True,
    )


StartTime: TypeAlias = datetime
EndTime: TypeAlias = datetime


def _groupers(
    start_time: datetime,
    end_time: datetime,
    evaluation_window: timedelta,
    sampling_interval: timedelta,
) -> Iterator[Tuple[StartTime, EndTime, pd.Grouper]]:
    """
    Yields pandas.Groupers from time series parameters.
    """
    if not sampling_interval:
        return
    total_time_span = end_time - start_time
    divisible = evaluation_window % sampling_interval == timedelta()
    if divisible and evaluation_window < total_time_span:
        max_offset = evaluation_window
    else:
        max_offset = total_time_span
    offsets = accumulate(
        repeat(sampling_interval),
        initial=timedelta(),
    )
    for offset in offsets:
        if offset >= max_offset:
            return
        # Each Grouper is like a row in a brick wall, where each brick is an
        # evaluation window. By shifting each row of bricks by the sampling
        # interval, we can get all the brick's right edges to line up with the
        # points of the time series, and together they will summarize data for
        # the whole time series.
        #
        #                   evaluation window
        #                   ┌──┴──┐
        #       ┌─────┬─────┬─────┬─────┐    offset groupers
        #     ┌─┴───┬─┴───┬─┴───┬─┴───┬─┘0 │ by sampling interval
        #   ┌─┴───┬─┴───┬─┴───┬─┴───┬─┘1   │
        #   └─────┴─────┴─────┴─────┘2     ▼
        #         ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐    combine into
        #         └─┴─┴─┴─┴─┴─┴─┴─┴─┴2┴1┘0   final time series
        #
        grouper = pd.Grouper(  # type: ignore  # mypy finds the wrong Grouper
            freq=evaluation_window,
            origin=end_time,
            offset=-offset,
            # Each point in timeseries will be labeled by the end instant of
            # its evaluation window.
            label="right",
            sort=False,
        )
        time_stop = end_time - offset
        if divisible:
            time_start = start_time - evaluation_window
        else:
            time_start = time_stop - evaluation_window
        yield (
            time_start,
            time_stop,
            grouper,
        )


def _results(
    calcs: Iterable[Metric],
    dataframe: pd.DataFrame,
    start_time: datetime,
    end_time: datetime,
    evaluation_window: timedelta,
    sampling_interval: timedelta,
) -> Iterator[pd.DataFrame]:
    """
    Yields metric results for each data point in time series.
    """
    yield pd.DataFrame()
    calculate_metrics = partial(
        multi_calculate,
        calcs=calcs,
    )
    # pandas time indexing is end-inclusive
    result_slice = slice(start_time, end_time)
    for (
        time_start,  # inclusive
        time_stop,  # exclusive
        group,
    ) in _groupers(
        start_time=start_time,
        end_time=end_time,
        evaluation_window=evaluation_window,
        sampling_interval=sampling_interval,
    ):
        row_start, row_stop = row_interval_from_sorted_time_index(
            time_index=cast(pd.DatetimeIndex, dataframe.index),
            time_start=time_start,  # inclusive
            time_stop=time_stop,  # exclusive
        )
        # pandas row indexing is stop-exclusive
        row_slice = slice(row_start, row_stop)
        filtered = dataframe.iloc[row_slice, :]
        res = filtered.groupby(
            group,
            group_keys=True,
        ).apply(
            calculate_metrics,
        )

        # NB: on ubuntu, we lose the timezone information when there is no data
        if res.index.tzinfo is None:  # type: ignore
            res = res.set_axis(
                res.index.tz_localize(  # type: ignore
                    timezone.utc,
                ),
                axis=0,
            )

        yield res.loc[result_slice, :]
