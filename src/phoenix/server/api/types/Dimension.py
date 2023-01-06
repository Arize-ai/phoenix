import strawberry

from phoenix.core import Dimension as CoreDimension

from .DimensionDataQuality import DimensionDataQuality
from .DimensionDataType import DimensionDataType
from .node import Node


@strawberry.type
class Dimension(Node):
    name: str
    dataType: DimensionDataType

    @strawberry.field
    def dataQuality(self) -> DimensionDataQuality:
        return DimensionDataQuality(dimension_name=self.name)


def to_gql_dimension(id_attr: int, dimension: CoreDimension) -> Dimension:
    """
    Converts a phoenix.core.Dimension to a phoenix.server.api.types.Dimension
    """
    return Dimension(
        id_attr=id_attr,
        name=dimension.name,
        dataType=DimensionDataType[dimension.data_type.value],
    )
