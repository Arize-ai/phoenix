from datetime import datetime, timedelta
from functools import partial
from itertools import accumulate, chain, repeat, takewhile
from typing import Any, Callable, Generator, Iterable, List, Tuple, Union, cast

import pandas as pd

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
    return pd.Series(dict(calc(df) for calc in calcs))


def _time_slice_from_sorted_index(idx: pd.Index, start: datetime, end: datetime) -> slice:
    """
    Returns end exclusive time slice from sorted index.
    """
    return slice(*cast(List[int], idx.searchsorted((start, end))))


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
    columns: Union[List[int], slice] = list(
        set(
            dataframe.columns.get_loc(column_name)
            for calc in calcs
            for column_name in calc.input_columns()
        ),
    ) or slice(None)
    return pd.concat(
        chain(
            (pd.DataFrame(),),
            (
                dataframe.iloc[
                    _time_slice_from_sorted_index(dataframe.index, start, end),
                    columns,
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
) -> Generator[Tuple[datetime, datetime, pd.Grouper], None, None]:
    """
    Yields pandas.Groupers from time series parameters.
    """
    divisible = evaluation_window % sampling_interval == timedelta()
    max_offset = evaluation_window if divisible else end_time - start_time
    yield from (
        (
            start_time if divisible else max(start_time, end_time - offset - evaluation_window),
            end_time - offset,
            pd.Grouper(  # type: ignore  # mypy finds the wrong Grouper
                freq=evaluation_window,
                origin=end_time,
                offset=offset,
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
