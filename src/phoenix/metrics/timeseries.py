from datetime import datetime, timedelta
from itertools import accumulate, chain, repeat, takewhile
from typing import Callable, Iterable, NamedTuple, Optional, Set, Union

import pandas as pd

from phoenix.metrics.metrics import Count
from phoenix.metrics.mixins import Metric


def timeseries(
    start: datetime,
    end: datetime,
    evaluation_window: Optional[timedelta] = None,
    sampling_interval: Optional[timedelta] = None,
) -> Callable[..., pd.DataFrame]:
    """
    timeseries returns an aggregator for use by pandas.DataFrame.pipe in
    conjunction with a set of Metrics to return a final time-series output in
    the form of a pandas.DataFrame where the row index is timestamp and columns
    identified each by the Metric's ID. Use each input metric's get_value() on
    the rows to extract the corresponding metric output value.
    """
    evaluation_window = evaluation_window or (end - start)
    time_range = f"'{start:%Y-%m-%dT%H:%M:%S.%f%z}' <= index < '{end:%Y-%m-%dT%H:%M:%S.%f%z}'"

    def aggregator(
        dataframe: pd.DataFrame,
        *,
        where: Optional[str] = None,
        metrics: Optional[Iterable[Metric]] = None,
    ) -> pd.DataFrame:
        calcs: Iterable[Metric] = metrics or (Count(),)
        input_columns: Union[Set[str], pd.Index] = set(
            chain.from_iterable(calc.input_columns() for calc in calcs)
        )
        # TODO: implement filtering: `where` below is only proof-of-concept.
        if len(input_columns) == 0 or where:
            input_columns = dataframe.columns
        try:
            assert evaluation_window is not None  # for type checker
            if end <= start or dataframe.empty or evaluation_window < timedelta():
                raise ValueError
            return pd.concat(
                dataframe.loc[:, input_columns]  # type: ignore
                .query(time_range + ((" and (" + where + ")") if where else ""))
                .groupby(group)
                .apply(lambda df: pd.Series(dict(calc(df) for calc in calcs)))  # type: ignore
                .loc[start:end, :]  # type: ignore
                for group in (
                    pd.Grouper(  # type: ignore
                        freq=evaluation_window,
                        origin=end,
                        offset=offset,
                        label="right",
                        sort=False,
                    )
                    for offset in takewhile(
                        lambda offset: offset < evaluation_window,  # type: ignore
                        accumulate(
                            repeat(sampling_interval or evaluation_window),
                            initial=timedelta(),
                        ),
                    )
                )
            ).sort_index()
        except ValueError:
            return pd.concat((calc.empty_result() for calc in calcs), axis=1)

    return aggregator


class TimeseriesParams(NamedTuple):
    start: datetime
    end: datetime
    evaluation_window: Optional[timedelta] = None
    sampling_interval: Optional[timedelta] = None
