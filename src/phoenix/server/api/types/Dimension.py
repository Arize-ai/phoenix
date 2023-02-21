from typing import Optional

import strawberry
from strawberry.types import Info

from phoenix.core import Dimension as CoreDimension
from phoenix.server.api.context import Context

from .DataQualityMetric import DataQualityMetric
from .DimensionDataType import DimensionDataType
from .DimensionType import DimensionType
from .node import Node


@strawberry.type
class Dimension(Node):
    name: str = strawberry.field(description="The name of the dimension (a.k.a. the column name)")
    type: DimensionType = strawberry.field(
        description="Whether the dimension represents a feature, tag, prediction, or actual."
    )

    dataType: DimensionDataType = strawberry.field(
        description="The data type of the column. Categorical or numeric."
    )

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
