from typing import Optional

import strawberry


def get_dimension_data_quality() -> "DimensionDataQuality":
    return DimensionDataQuality(cardinality=None)


@strawberry.type
class DimensionDataQuality:
    cardinality: Optional[int]


@strawberry.type
class Dimension:
    name: str
    dataQuality: DimensionDataQuality
