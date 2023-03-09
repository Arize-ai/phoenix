import math
from datetime import datetime, timedelta
from functools import total_ordering
from typing import Iterable, List, Optional, Union, cast

import pandas as pd
import strawberry

from phoenix.core.model import Model
from phoenix.metrics import Metric
from phoenix.metrics.mixins import DriftOperator, VectorOperator
from phoenix.metrics.timeseries import timeseries
from phoenix.server.api.input_types.Granularity import Granularity, to_timestamps
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types import METRICS
from phoenix.server.api.types.DataQualityMetric import DataQualityMetric
from phoenix.server.api.types.DriftMetric import DriftMetric


@strawberry.type
@total_ordering
class TimeSeriesDataPoint:
    """A data point in a time series"""

    """The timestamp of the data point"""
    timestamp: datetime

    """The value of the data point"""
    value: Optional[float]

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
        value = metric.get_value(row)
        data.append(
            TimeSeriesDataPoint(
                timestamp=timestamp,
                value=None if math.isnan(value) else value,
            )
        )
    return sorted(data)


@strawberry.interface
class TimeSeries:
    """A collection of data points over time"""

    data: List[TimeSeriesDataPoint]

    def __init__(
        self,
        name: str,
        model: Model,
        metric: Union[DriftMetric, DataQualityMetric],
        time_range: Optional[TimeRange] = None,
        granularity: Optional[Granularity] = None,
    ):
        if not (metric_cls := METRICS.get(metric.value, None)):
            raise NotImplementedError(f"Metric {metric} is not implemented.")
        dataset = model.primary_dataset
        metric_instance = metric_cls(
            column_name=(
                dataset.get_embedding_vector_column(name).name
                if issubclass(metric_cls, VectorOperator)
                else name
            )
        )
        if (
            issubclass(metric_cls, DriftOperator)
            and (ref_dataset := model.reference_dataset) is not None
        ):
            metric_instance.reference_data = ref_dataset.dataframe
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
        self.data = dataset.dataframe.pipe(
            timeseries(
                start_time=time_range.start,
                end_time=time_range.end,
                evaluation_window=timedelta(minutes=granularity.evaluation_window_minutes),
                sampling_interval=timedelta(minutes=granularity.sampling_interval_minutes),
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

    def __init__(
        self,
        name: str,
        model: Model,
        metric: DataQualityMetric,
        time_range: Optional[TimeRange] = None,
        granularity: Optional[Granularity] = None,
    ):
        super().__init__(
            name,
            model,
            metric,
            time_range,
            granularity,
        )


@strawberry.type
class DriftTimeSeries(TimeSeries):
    """A time series of drift metrics"""

    def __init__(
        self,
        name: str,
        model: Model,
        metric: DriftMetric,
        time_range: Optional[TimeRange] = None,
        granularity: Optional[Granularity] = None,
    ):
        super().__init__(
            name,
            model,
            metric,
            time_range,
            granularity,
        )
