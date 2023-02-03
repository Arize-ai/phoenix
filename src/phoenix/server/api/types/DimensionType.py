from enum import Enum

import strawberry


@strawberry.enum
class DimensionType(Enum):
    feature = "feature"
    tag = "tag"
    prediction = "prediction"
    actual = "actual"
