import strawberry

from .DimensionDataQuality import DimensionDataQuality
from .DimensionDataType import DimensionDataType


@strawberry.type
class Dimension:
    name: str
    dataType: DimensionDataType

    @strawberry.field
    def dataQuality(self) -> DimensionDataQuality:
        return DimensionDataQuality(dimension_name=self.name)
