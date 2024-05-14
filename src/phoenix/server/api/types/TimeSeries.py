from dataclasses import replace
from datetime import datetime, timedelta
from functools import total_ordering
from typing import Iterable, List, Optional, Tuple, Union, cast

import pandas as pd
import strawberry
from strawberry import UNSET

from phoenix.core.model_schema import CONTINUOUS, PRIMARY, REFERENCE, Column, Dimension, Inferences
from phoenix.metrics import Metric, binning
from phoenix.metrics.mixins import UnaryOperator
from phoenix.metrics.timeseries import timeseries
from phoenix.server.api.input_types.Granularity import Granularity, to_timestamps
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.interceptor import GqlValueMediator
from phoenix.server.api.types.DataQualityMetric import DataQualityMetric
from phoenix.server.api.types.InferencesRole import InferencesRole
from phoenix.server.api.types.ScalarDriftMetricEnum import ScalarDriftMetric
from phoenix.server.api.types.VectorDriftMetricEnum import VectorDriftMetric


@strawberry.type
@total_ordering
class TimeSeriesDataPoint:
    """A data point in a time series"""

    """The timestamp of the data point"""
    timestamp: datetime

    """The value of the data point"""
    value: Optional[float] = strawberry.field(default=GqlValueMediator())

    def __lt__(self, other: "TimeSeriesDataPoint") -> bool:  # type: ignore
        return self.timestamp < other.timestamp


def to_gql_datapoints(
    df: pd.DataFrame,
    metric: Metric,
    timestamps: Iterable[datetime],
) -> List[TimeSeriesDataPoint]:
    data = []
    for timestamp in timestamps:
        try:
            row = df.iloc[cast(int, df.index.get_loc(timestamp)), :].to_dict()
        except KeyError:
            row = {}
        data.append(
            TimeSeriesDataPoint(
                timestamp=timestamp,
                value=metric.get_value(row),
            )
        )
    return sorted(data)


@strawberry.interface
class TimeSeries:
    """A collection of data points over time"""

    data: List[TimeSeriesDataPoint]


def get_timeseries_data(
    df: pd.DataFrame,
    metric: Metric,
    time_range: TimeRange,
    granularity: Granularity,
) -> List[TimeSeriesDataPoint]:
    return df.pipe(
        timeseries(
            start_time=time_range.start,
            end_time=time_range.end,
            evaluation_window=timedelta(
                minutes=granularity.evaluation_window_minutes,
            ),
            sampling_interval=timedelta(
                minutes=granularity.sampling_interval_minutes,
            ),
        ),
        metrics=(metric,),
    ).pipe(
        to_gql_datapoints,
        metric=metric,
        timestamps=to_timestamps(time_range, granularity),
    )


@strawberry.type
class DataQualityTimeSeries(TimeSeries):
    """A time series of data quality metrics"""


def get_data_quality_timeseries_data(
    dimension: Dimension,
    metric: DataQualityMetric,
    time_range: TimeRange,
    granularity: Granularity,
    inferences_role: InferencesRole,
) -> List[TimeSeriesDataPoint]:
    metric_instance = metric.value()
    if isinstance(metric_instance, UnaryOperator):
        metric_instance = replace(
            metric_instance,
            operand=Column(dimension.name),
        )
    df = pd.DataFrame(
        {dimension.name: dimension[inferences_role.value]},
        copy=False,
    )
    return get_timeseries_data(
        df,
        metric_instance,
        time_range,
        granularity,
    )


@strawberry.type
class DriftTimeSeries(TimeSeries):
    """A time series of drift metrics"""


def get_drift_timeseries_data(
    dimension: Dimension,
    metric: Union[ScalarDriftMetric, VectorDriftMetric],
    time_range: TimeRange,
    granularity: Granularity,
    reference_data: pd.DataFrame,
) -> List[TimeSeriesDataPoint]:
    metric_instance = metric.value()
    metric_instance = replace(
        metric_instance,
        operand=Column(dimension.name),
        reference_data=reference_data,
    )
    if isinstance(metric, ScalarDriftMetric) and dimension.data_type is CONTINUOUS:
        metric_instance = replace(
            metric_instance,
            binning_method=binning.QuantileBinning(
                reference_series=dimension[REFERENCE],
            ),
        )
    df = pd.DataFrame(
        {dimension.name: dimension[PRIMARY]},
        copy=False,
    )
    return get_timeseries_data(
        df,
        metric_instance,
        time_range,
        granularity,
    )


@strawberry.type
class PerformanceTimeSeries(TimeSeries):
    """A time series of drift metrics"""


def ensure_timeseries_parameters(
    inferences: Inferences,
    time_range: Optional[TimeRange] = UNSET,
    granularity: Optional[Granularity] = UNSET,
) -> Tuple[TimeRange, Granularity]:
    if not isinstance(time_range, TimeRange):
        start, stop = inferences.time_range
        time_range = TimeRange(start=start, end=stop)
    if not isinstance(granularity, Granularity):
        total_minutes = int((time_range.end - time_range.start).total_seconds()) // 60
        granularity = Granularity(
            evaluation_window_minutes=total_minutes,
            sampling_interval_minutes=total_minutes,
        )
    return time_range, granularity
