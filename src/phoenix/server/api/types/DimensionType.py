from enum import Enum

import strawberry


@strawberry.enum
class DimensionType(Enum):
    PREDICTION = "PREDICTION"
    ACTUAL = "ACTUAL"
    FEATURE = "FEATURE"
    TAG = "TAG"
    EMBEDDING = "EMBEDDING"
