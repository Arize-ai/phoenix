from enum import Enum

import strawberry


@strawberry.enum
class DataQualityMetric(Enum):
    cardinality = "cardinality"
