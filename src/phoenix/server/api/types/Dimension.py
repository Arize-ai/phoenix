import strawberry

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
