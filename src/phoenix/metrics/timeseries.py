from datetime import datetime, timedelta
from functools import partial
from itertools import accumulate, repeat
from typing import Any, Callable, Iterable, Iterator, Tuple, cast

import pandas as pd
from typing_extensions import TypeAlias

from . import Metric


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


def _calculate(
    df: pd.DataFrame,
    calcs: Iterable[Metric],
) -> "pd.Series[Any]":
    """
    Calculates each metric on the dataframe.
    """
    return pd.Series({calc.id(): calc(df) for calc in calcs})


StartIndex: TypeAlias = int
StopIndex: TypeAlias = int


def row_interval_from_sorted_time_index(
    time_index: pd.Index,
    start_time: datetime,
    end_time: datetime,
) -> Tuple[StartIndex, StopIndex]:
    """
    Returns end exclusive time slice from sorted index.
    """
    return cast(
        Tuple[StartIndex, StopIndex],
        time_index.searchsorted((start_time, end_time)),
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
    unique_input_column_indices = set()
    for calc in calcs:
        for column_name in calc.input_column_names():
            column_index = dataframe.columns.get_loc(column_name)
            unique_input_column_indices.add(column_index)
    input_column_indices = sorted(unique_input_column_indices)
    # need at least one column in the dataframe, so take the first one
    # if input_column_indices is empty
    if len(input_column_indices) == 0:
        input_column_indices = [0]
    dataframe = dataframe.iloc[:, input_column_indices]
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
        time_filter_end = end_time - offset
        if divisible:
            time_filter_start = start_time - evaluation_window
        else:
            time_filter_start = time_filter_end - evaluation_window
        yield (
            time_filter_start,
            time_filter_end,
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
    calculate_metrics = partial(_calculate, calcs=calcs)
    result_slice = slice(start_time, end_time)
    for (
        time_filter_start,
        time_filter_end,
        group,
    ) in _groupers(
        start_time=start_time,
        end_time=end_time,
        evaluation_window=evaluation_window,
        sampling_interval=sampling_interval,
    ):
        row_start, row_end = row_interval_from_sorted_time_index(
            time_index=dataframe.index,
            start_time=time_filter_start,
            end_time=time_filter_end,
        )
        row_slice = slice(row_start, row_end)
        filtered = dataframe.iloc[row_slice, :]
        yield filtered.groupby(
            group,
            group_keys=True,
        ).apply(
            calculate_metrics,
        ).loc[result_slice, :]
