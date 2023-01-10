from enum import Enum

import strawberry


@strawberry.enum
class DimensionCategory(Enum):
    feature = "feature"
    tag = "tag"
    prediction = "prediction"
    actual = "actual"
