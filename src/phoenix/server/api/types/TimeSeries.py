from datetime import datetime, timedelta
from functools import total_ordering
from typing import Iterable, List, Optional, Union, cast

import pandas as pd
import strawberry

from phoenix.core.model import Model
from phoenix.metrics import Metric, binning
from phoenix.metrics.mixins import DriftOperator
from phoenix.metrics.timeseries import timeseries
from phoenix.server.api.input_types.Granularity import Granularity, to_timestamps
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.interceptor import NoneIfNan
from phoenix.server.api.types import METRICS
from phoenix.server.api.types.DataQualityMetric import DataQualityMetric
from phoenix.server.api.types.DimensionDataType import DimensionDataType
from phoenix.server.api.types.ScalarDriftMetricEnum import ScalarDriftMetric
from phoenix.server.api.types.VectorDriftMetricEnum import VectorDriftMetric


@strawberry.type
@total_ordering
class TimeSeriesDataPoint:
    """A data point in a time series"""

    """The timestamp of the data point"""
    timestamp: datetime

    """The value of the data point"""
    value: Optional[float] = strawberry.field(default=NoneIfNan())

    def __lt__(self, other: "TimeSeriesDataPoint") -> bool:
        return self.timestamp < other.timestamp


def to_gql_datapoints(
    df: pd.DataFrame, metric: Metric, timestamps: Iterable[datetime]
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


def _get_timeseries_data(
    column_name: str,
    model: Model,
    metric: Union[ScalarDriftMetric, VectorDriftMetric, DataQualityMetric],
    time_range: Optional[TimeRange] = None,
    granularity: Optional[Granularity] = None,
    dtype: Optional[DimensionDataType] = None,
) -> List[TimeSeriesDataPoint]:
    if not (metric_cls := METRICS.get(metric.value, None)):
        raise NotImplementedError(f"Metric {metric} is not implemented.")
    dataset = model.primary_dataset
    metric_instance = metric_cls(operand_column_name=column_name)
    if issubclass(metric_cls, DriftOperator) and model.reference_dataset is not None:
        reference_data = model.reference_dataset.dataframe
        metric_instance.reference_data = reference_data
        if dtype is DimensionDataType.numeric:
            operand_column_name = next(iter(metric_instance.input_column_names()), "")
            if operand_column_name in reference_data.columns:
                reference_series = reference_data.loc[:, operand_column_name]
            else:
                reference_series = pd.Series(dtype=float)
            metric_instance.binning_method = binning.QuantileBinning(
                reference_series=reference_series,
            )
    if time_range is None:
        time_range = TimeRange(
            start=dataset.start_time,
            end=dataset.end_time,
        )
    if granularity is None:
        total_minutes = int((time_range.end - time_range.start).total_seconds()) // 60
        granularity = Granularity(
            evaluation_window_minutes=total_minutes,
            sampling_interval_minutes=total_minutes,
        )
    return dataset.dataframe.pipe(
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
        metrics=(metric_instance,),
    ).pipe(
        to_gql_datapoints,
        metric=metric_instance,
        timestamps=to_timestamps(time_range, granularity),
    )


@strawberry.type
class DataQualityTimeSeries(TimeSeries):
    """A time series of data quality metrics"""


def get_data_quality_timeseries_data(
    column_name: str,
    model: Model,
    metric: DataQualityMetric,
    time_range: Optional[TimeRange] = None,
    granularity: Optional[Granularity] = None,
    dtype: Optional[DimensionDataType] = None,
) -> List[TimeSeriesDataPoint]:
    return _get_timeseries_data(
        column_name,
        model,
        metric,
        time_range,
        granularity,
        dtype,
    )


@strawberry.type
class DriftTimeSeries(TimeSeries):
    """A time series of drift metrics"""


def get_drift_timeseries_data(
    column_name: str,
    model: Model,
    metric: Union[ScalarDriftMetric, VectorDriftMetric],
    time_range: Optional[TimeRange] = None,
    granularity: Optional[Granularity] = None,
    dtype: Optional[DimensionDataType] = None,
) -> List[TimeSeriesDataPoint]:
    return _get_timeseries_data(
        column_name,
        model,
        metric,
        time_range,
        granularity,
        dtype,
    )
