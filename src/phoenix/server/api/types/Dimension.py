from typing import Optional

import strawberry
from strawberry.types import Info

from phoenix.core import Dimension as CoreDimension
from phoenix.metrics.mixins import SingleOperandMetric
from phoenix.metrics.timeseries import timeseries
from phoenix.server.api.context import Context

from ..input_types.TimeRange import TimeRange, ensure_time_range
from . import METRICS
from .DataQualityMetric import DataQualityMetric
from .DimensionDataType import DimensionDataType
from .DimensionType import DimensionType
from .node import Node
from .TimeSeries import TimeSeries, to_gql_timeseries


@strawberry.type
class Dimension(Node):
    name: str
    type: DimensionType
    dataType: DimensionDataType

    @strawberry.field
    async def dataQualityMetric(
        self,
        info: Info[Context, None],
        metric: DataQualityMetric,
        time_range: Optional[TimeRange] = None,
    ) -> Optional[TimeSeries]:
        dimension_name = self.name
        metric_cls = METRICS.get(metric.value, None)
        if not metric_cls or not issubclass(metric_cls, SingleOperandMetric):
            raise NotImplementedError(f"Metric {metric} is not implemented.")
        dataset = info.context.model.primary_dataset
        time_range = ensure_time_range(dataset, time_range)
        metric_instance = metric_cls(dimension_name)
        return dataset.dataframe.pipe(
            timeseries(**(time_range.to_timeseries_params()._asdict())),
            metrics=(metric_instance,),
        ).pipe(to_gql_timeseries, extractor=metric_instance)


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
