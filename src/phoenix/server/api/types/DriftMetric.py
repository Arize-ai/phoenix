from enum import Enum

import strawberry


@strawberry.enum
class DriftMetric(Enum):
    euclideanDistance = "euclideanDistance"
