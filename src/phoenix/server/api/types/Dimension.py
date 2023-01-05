import strawberry

from .DimensionDataQuality import DimensionDataQuality
from .DimensionDataType import DimensionDataType
from .DimensionType import DimensionType


@strawberry.type
class Dimension:
    name: str
    type: DimensionType
    dataType: DimensionDataType

    @strawberry.field
    def dataQuality(self) -> DimensionDataQuality:
        return DimensionDataQuality(dimension_name=self.name)
