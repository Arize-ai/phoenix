from typing import Optional

import strawberry


@strawberry.type
class DimensionDataQuality:
    cardinality: Optional[int]


@strawberry.type
class Dimension:
    name: str

    @strawberry.field
    def dataQuality(self) -> DimensionDataQuality:
        return DimensionDataQuality(cardinality=5)
