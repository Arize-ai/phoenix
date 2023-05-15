from enum import Enum

import strawberry

from phoenix.metrics.metrics import Cardinality, Count, Max, Mean, Min, PercentEmpty, Sum


@strawberry.enum
class DataQualityMetric(Enum):
    cardinality = Cardinality
    percentEmpty = PercentEmpty
    mean = Mean
    sum = Sum
    min = Min
    max = Max
    count = Count
