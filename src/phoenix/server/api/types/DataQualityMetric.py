from enum import Enum
from functools import partial

import strawberry

from phoenix.metrics.metrics import Cardinality, Count, Max, Mean, Min, PercentEmpty, Quantile, Sum


@strawberry.enum
class DataQualityMetric(Enum):
    cardinality = Cardinality
    percentEmpty = PercentEmpty
    mean = Mean
    sum = Sum
    min = Min
    max = Max
    count = Count
    p01 = partial(Quantile, probability=0.01)
    p25 = partial(Quantile, probability=0.25)
    p50 = partial(Quantile, probability=0.50)
    p75 = partial(Quantile, probability=0.75)
    p99 = partial(Quantile, probability=0.99)
