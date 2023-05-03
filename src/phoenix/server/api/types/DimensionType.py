from enum import Enum

import strawberry

from phoenix.core.model_schema import (
    ACTUAL_LABEL,
    ACTUAL_SCORE,
    FEATURE,
    PREDICTION_LABEL,
    PREDICTION_SCORE,
    TAG,
    Dimension,
)


@strawberry.enum
class DimensionType(Enum):
    feature = "feature"
    tag = "tag"
    prediction = "prediction"
    actual = "actual"

    @classmethod
    def from_dimension(cls, dim: Dimension) -> "DimensionType":
        role = dim.role
        if role in (FEATURE,):
            return cls.feature
        if role in (TAG,):
            return cls.tag
        if role in (PREDICTION_LABEL, PREDICTION_SCORE):
            return cls.prediction
        if role in (ACTUAL_LABEL, ACTUAL_SCORE):
            return cls.actual
        raise ValueError("invalid type for dimension %s" % repr(dim))
