from typing import Optional

import strawberry
from strawberry.types import Info

from phoenix.core import Dimension as CoreDimension
from phoenix.metrics.mixins import UnaryOperator
from phoenix.metrics.timeseries import timeseries
from phoenix.server.api.context import Context

from ..input_types.TimeRange import (
    Granularity,
    TimeRange,
    ensure_time_range,
    to_timeseries_params,
    to_timestamps,
)
from . import METRICS
from .DataQualityMetric import DataQualityMetric
from .DataQualityTimeSeries import DataQualityTimeSeries, to_gql_timeseries
from .DimensionDataType import DimensionDataType
from .DimensionType import DimensionType
from .node import Node


@strawberry.type
class Dimension(Node):
    name: str
    type: DimensionType
    dataType: DimensionDataType

    @strawberry.field
    async def dataQualityMetric(
        self, metric: DataQualityMetric, info: Info[Context, None]
    ) -> Optional[float]:
        dimension_name = self.name
        if metric is DataQualityMetric.cardinality:
            return await info.context.loaders.cardinality.load(dimension_name)
        elif metric is DataQualityMetric.percentEmpty:
            return await info.context.loaders.percent_empty.load(dimension_name)
        raise NotImplementedError(f"Metric {metric} is not implemented.")

    @strawberry.field
    def data_quality_time_series(
        self,
        info: Info[Context, None],
        metric: DataQualityMetric,
        time_range: Optional[TimeRange] = None,
        granularity: Optional[Granularity] = None,
    ) -> Optional[DataQualityTimeSeries]:
        dimension_name = self.name
        metric_cls = METRICS.get(metric.value, None)
        if not metric_cls or not issubclass(metric_cls, UnaryOperator):
            raise NotImplementedError(f"Metric {metric} is not implemented.")
        dataset = info.context.model.primary_dataset
        time_range = ensure_time_range(dataset, time_range)
        metric_instance = metric_cls(dimension_name)
        return dataset.dataframe.pipe(
            timeseries(**(to_timeseries_params(time_range, granularity)._asdict())),
            metrics=(metric_instance,),
        ).pipe(
            to_gql_timeseries,
            metric=metric_instance,
            timestamps=to_timestamps(time_range, granularity),
        )


def to_gql_dimension(id_attr: int, dimension: CoreDimension) -> Dimension:
    """
    Converts a phoenix.core.Dimension to a phoenix.server.api.types.Dimension
    """
    return Dimension(
        id_attr=id_attr,
        name=dimension.name,
        type=DimensionType[dimension.type.value],
        dataType=DimensionDataType[dimension.data_type.value],
    )
