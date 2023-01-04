import strawberry

from .DimensionDataQuality import DimensionDataQuality
from .DimensionDataType import DimensionDataType
from .DimensionType import DimensionType


@strawberry.type
class Dimension:
    name: str
    type: DimensionType
    data_type: DimensionDataType

    @strawberry.field
    def data_quality(self) -> DimensionDataQuality:
        return DimensionDataQuality(dimension_name=self.name)
