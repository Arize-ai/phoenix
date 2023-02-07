from enum import Enum

import strawberry


@strawberry.enum
class DriftMetric(Enum):
    euclidean_distance = "euclidean_distance"
