from enum import Enum

import strawberry

from phoenix.core.data_type import CONTINUOUS
from phoenix.core.dimension import Dimension


@strawberry.enum
class DimensionDataType(Enum):
    categorical = "categorical"
    numeric = "numeric"

    @classmethod
    def from_dimension(cls, dimension: Dimension) -> "DimensionDataType":
        data_type = dimension.data_type
        if data_type in (CONTINUOUS,):
            return cls.numeric
        return cls.categorical
