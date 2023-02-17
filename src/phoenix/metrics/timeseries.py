from datetime import datetime, timedelta
from functools import partial
from itertools import accumulate, chain, repeat, takewhile
from typing import Callable, Generator, Iterable, NamedTuple, Optional, Tuple, Union

import pandas as pd

from .metrics import Count
from .mixins import Metric


def timeseries(
    start_time: datetime,
    end_time: datetime,
    evaluation_window: Optional[timedelta] = None,
    sampling_interval: Optional[timedelta] = None,
) -> Callable[..., pd.DataFrame]:
    """
    timeseries returns an aggregator for use by pandas.DataFrame.pipe() in
    conjunction with a list of Metrics to return a final time-series output in
    the form of a pandas.DataFrame where the row index is timestamp and each
    column is identified by each Metric's ID. Apply each metric's get_value() on
    the rows to extract the corresponding metric output value.
    """
    if not evaluation_window:
        evaluation_window = end_time - start_time
    if not sampling_interval:
        sampling_interval = evaluation_window

    return partial(
        _aggregator,
        start_time=start_time,
        end_time=end_time,
        evaluation_window=evaluation_window,
        sampling_interval=sampling_interval,
    )


def _aggregator(
    dataframe: pd.DataFrame,
    *,
    start_time: datetime,
    end_time: datetime,
    evaluation_window: timedelta,
    sampling_interval: timedelta,
    metrics: Optional[Iterable[Metric]] = None,
) -> pd.DataFrame:
    calcs: Tuple[Metric, ...] = tuple(metrics or (Count(),))
    input_columns: Union[Tuple[str, ...], pd.Index] = (
        tuple(set(column_name for calc in calcs for column_name in calc.input_columns()))
        or dataframe.columns
    )
    return pd.concat(
        chain(
            (pd.DataFrame(),),
            (
                dataframe.loc[time_slice, input_columns]  # type: ignore
                .groupby(group)
                .apply(lambda df: pd.Series(dict(calc(df) for calc in calcs)))  # type: ignore
                .loc[start_time:end_time, :]  # type: ignore
                for time_slice, group in _groupers(
                    start_time=start_time,
                    end_time=end_time,
                    evaluation_window=evaluation_window,
                    sampling_interval=sampling_interval,
                )
            ),
        )
    )


def _groupers(
    start_time: datetime,
    end_time: datetime,
    evaluation_window: timedelta,
    sampling_interval: timedelta,
) -> Generator[Tuple[slice, pd.Grouper], None, None]:
    if evaluation_window % sampling_interval:  # not divisible
        max_offset = end_time - start_time

        def time_slice(offset: timedelta) -> slice:
            # Because pandas time indexing is end inclusive, a microsecond
            # timedelta is subtracted from the end time.
            return slice(
                max(start_time, end_time - offset - evaluation_window),
                end_time - offset - timedelta(microseconds=1),
            )

    else:
        max_offset = evaluation_window

        def time_slice(offset: timedelta) -> slice:
            # Because pandas time indexing is end inclusive, a microsecond
            # timedelta is subtracted from the end time.
            return slice(start_time, end_time - offset - timedelta(microseconds=1))

    yield from (
        (
            time_slice(offset),
            pd.Grouper(  # type: ignore
                freq=evaluation_window,
                origin=end_time,
                offset=offset,
                # Each point in timeseries will be labeled by the end instant of
                # its evaluation window.
                label="right",
                sort=False,
            ),
        )
        # Each Grouper is like a row in a brick wall, and each brick represents
        # an evaluation window. By shifting each row of bricks by the sampling
        # interval, we can get all of the brick's right edges to line up with
        # the points of the time series, and together they will summarize the
        # data for the entire time series.
        #    ┌─────┬─────┬─────┬─────┐
        #    └─┬───┴─┬───┴─┬───┴─┬───┴─┐
        #      └─┬───┴─┬───┴─┬───┴─┬───┴─┐
        #        └─────┴─────┴─────┴─────┘
        for offset in takewhile(
            lambda offset: offset < max_offset,
            accumulate(repeat(sampling_interval), initial=timedelta()),
        )
    )


class TimeseriesParams(NamedTuple):
    start_time: datetime
    end_time: datetime
    evaluation_window: Optional[timedelta] = None
    sampling_interval: Optional[timedelta] = None
