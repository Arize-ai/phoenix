from typing import Any, Optional

import strawberry
from strawberry.types import Info

from .DimensionDataType import DimensionDataType

# import phoenix.metrics as metrics


@strawberry.type
class DimensionDataQuality:
    cardinality: Optional[int]


@strawberry.type
class Dimension:
    name: str
    dataType: DimensionDataType

    @strawberry.field
    def dataQuality(self, info: Info[Any, Any]) -> DimensionDataQuality:
        # count would be N
        # metrics.cardinality(info.context.primary_df, [self.name])
        if self.dataType == DimensionDataType.categorical:
            return DimensionDataQuality(cardinality=5)
        else:
            return DimensionDataQuality(cardinality=None)
