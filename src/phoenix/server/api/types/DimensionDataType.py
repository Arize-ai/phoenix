from enum import Enum

import strawberry


@strawberry.enum
class DimensionDataType(Enum):
    categorical = "categorical"
    numeric = "numeric"
