from typing import Optional

import strawberry
from strawberry.types import Info

from .context import Context
from .DimensionDataType import DimensionDataType
from .DimensionType import DimensionType


@strawberry.type
class DimensionDataQuality:
    dimension_name: strawberry.Private[str]

    @strawberry.field
    async def cardinality(self, info: Info[Context, "Dimension"]) -> Optional[int]:
        return await info.context.loader.cardinality.load(self.dimension_name)


@strawberry.type
class Dimension:
    name: str
    type: DimensionType
    data_type: DimensionDataType

    @strawberry.field
    def data_quality(self) -> DimensionDataQuality:
        return DimensionDataQuality(dimension_name=self.name)
