from typing import Any, Optional

import strawberry
from strawberry.types import Info

from phoenix.datasets import Dataset
from phoenix.metrics.cardinality import cardinality

from .DimensionDataType import DimensionDataType
from .DimensionType import DimensionType


@strawberry.type
class DimensionDataQuality:
    cardinality: Optional[int]


@strawberry.type
class Dimension:
    name: str
    dataset: strawberry.Private[Dataset]
    type: DimensionType
    data_type: DimensionDataType

    @strawberry.field
    def data_quality(self, info: Info[Any, Any]) -> DimensionDataQuality:
        # count would be N
        # TODO attach to datasets to context
        # metrics.cardinality(info.context.primary_df, [self.name])
        if self.data_type == DimensionDataType.CATEGORICAL:
            return DimensionDataQuality(
                cardinality=cardinality(self.dataset.dataframe, column_names=[self.name])[self.name]
            )
        else:
            return DimensionDataQuality(cardinality=None)
