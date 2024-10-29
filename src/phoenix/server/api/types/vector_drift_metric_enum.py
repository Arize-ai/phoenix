from enum import Enum

import strawberry

from phoenix.metrics.metrics import EuclideanDistance


@strawberry.enum
class VectorDriftMetric(Enum):
    euclideanDistance = EuclideanDistance
