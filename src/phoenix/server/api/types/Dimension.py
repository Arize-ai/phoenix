from typing import Optional

import strawberry
from strawberry.types import Info

from phoenix.metrics.cardinality import cardinality

from .context import Context
from .DimensionDataType import DimensionDataType
from .DimensionType import DimensionType


@strawberry.type
class DimensionDataQuality:
    cardinality: Optional[int]


@strawberry.type
class Dimension:
    name: str
    type: DimensionType
    data_type: DimensionDataType

    @strawberry.field
    def data_quality(self, info: Info[Context, "Dimension"]) -> DimensionDataQuality:
        # count would be N
        # TODO attach to datasets to context
        # metrics.cardinality(info.context.primary_df, [self.name])
        if self.data_type == DimensionDataType.categorical:
            return DimensionDataQuality(
                cardinality=cardinality(
                    info.context.model.primary_dataset.dataframe, column_names=[self.name]
                )[self.name]
            )
        else:
            return DimensionDataQuality(cardinality=None)
