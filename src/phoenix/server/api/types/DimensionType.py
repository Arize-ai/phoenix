from enum import Enum

import strawberry


@strawberry.enum
class DimensionType(Enum):
    prediction = "prediction"
    actual = "actual"
    feature = "feature"
    tag = "tag"
    embedding = "embedding"
