from enum import Enum

import strawberry

from phoenix.core.model_schema import CONTINUOUS, Dimension


@strawberry.enum
class DimensionShape(Enum):
    continuous = "continuous"
    discrete = "discrete"

    @classmethod
    def from_dimension(cls, dim: Dimension) -> "DimensionShape":
        data_type = dim.data_type
        if data_type in (CONTINUOUS,):
            return cls.continuous

        # For now we assume all non-continuous data is discrete
        # E.g. floats are the only dimension data type that is continuous
        return cls.discrete
