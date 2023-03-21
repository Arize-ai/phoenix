from enum import Enum

import strawberry


@strawberry.enum
class VectorDriftMetric(Enum):
    euclideanDistance = "EuclideanDistance"
