from typing import Optional

import strawberry


@strawberry.type
class DimensionDataQuality:
    cardinality: Optional[int]


@strawberry.type
class Dimension:
    name: str
    dataQuality: DimensionDataQuality
