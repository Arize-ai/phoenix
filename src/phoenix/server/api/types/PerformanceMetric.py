from enum import Enum, auto
from typing import Callable, Mapping, cast

import strawberry

from phoenix.metrics.wrappers import SkEval


@strawberry.enum
class PerformanceMetric(Enum):
    accuracyScore = auto()


PERFORMANCE_METRIC_FUNCTIONS: Mapping[PerformanceMetric, Callable[..., float]] = {
    PerformanceMetric.accuracyScore: cast(Callable[..., float], SkEval.accuracy_score),
}
