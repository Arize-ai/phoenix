from datetime import datetime, timedelta
from functools import partial
from itertools import accumulate, chain, repeat, takewhile
from typing import Any, Callable, Iterable, Iterator, List, Tuple, cast

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


def _calculate(df: pd.DataFrame, calcs: Iterable[Metric]) -> "pd.Series[Any]":
    """
    Calculates each metric on the dataframe.
    """
    return pd.Series({calc.id(): calc(df) for calc in calcs})


StartIndex: TypeAlias = int
StopIndex: TypeAlias = int


def row_interval_from_sorted_time_index(
    idx: pd.Index, start: datetime, end: datetime
) -> Tuple[StartIndex, StopIndex]:
    """
    Returns end exclusive time slice from sorted index.
    """
    return cast(Tuple[StartIndex, StopIndex], idx.searchsorted((start, end)))


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
    calcs: Tuple[Metric, ...] = tuple(metrics)
    columns: List[int] = sorted(
        {dataframe.columns.get_loc(column.name) for calc in calcs for column in calc.operands()}
    )
    return pd.concat(
        chain(
            (pd.DataFrame(),),
            (
                dataframe.iloc[
                    slice(*row_interval_from_sorted_time_index(dataframe.index, start, end)),
                    columns or [0],  # need at least one, so take the first one
                ]
                .groupby(group, group_keys=True)
                .apply(partial(_calculate, calcs=calcs))
                .loc[start_time:end_time, :]  # type: ignore  # slice has no overload for datetime
                for start, end, group in _groupers(
                    start_time=start_time,
                    end_time=end_time,
                    evaluation_window=evaluation_window,
                    sampling_interval=sampling_interval,
                )
            ),
        ),
        verify_integrity=True,
    )


def _groupers(
    start_time: datetime,
    end_time: datetime,
    evaluation_window: timedelta,
    sampling_interval: timedelta,
) -> Iterator[Tuple[datetime, datetime, pd.Grouper]]:
    """
    Yields pandas.Groupers from time series parameters.
    """
    if not sampling_interval:
        return
    divisible = evaluation_window % sampling_interval == timedelta()
    max_offset = end_time - start_time
    if divisible and evaluation_window < max_offset:
        max_offset = evaluation_window
    yield from (
        (
            (start_time if divisible else end_time - offset) - evaluation_window,
            end_time - offset,
            pd.Grouper(  # type: ignore  # mypy finds the wrong Grouper
                freq=evaluation_window,
                origin=end_time,
                offset=-offset,
                # Each point in timeseries will be labeled by the end instant of
                # its evaluation window.
                label="right",
                sort=False,
            ),
        )
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
        for offset in takewhile(
            lambda offset: offset < max_offset,
            accumulate(repeat(sampling_interval), initial=timedelta()),
        )
    )
