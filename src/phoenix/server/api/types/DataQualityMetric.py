from enum import Enum

import strawberry


@strawberry.enum
class DataQualityMetric(Enum):
    cardinality = "Cardinality"
    percentEmpty = "PercentEmpty"
    mean = "Mean"
    sum = "Sum"
    min = "Min"
    max = "Max"
    count = "Count"
