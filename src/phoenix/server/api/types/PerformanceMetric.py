from enum import Enum
from functools import partial

import strawberry

from phoenix.metrics.wrappers import SkEval


@strawberry.enum
class PerformanceMetric(Enum):
    # To become enum values, functions need to be wrapped in partial.
    # See https://stackoverflow.com/a/40339397
    accuracyScore = partial(SkEval.accuracy_score)  # type: ignore
