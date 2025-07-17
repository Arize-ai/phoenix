from enum import Enum, auto
from functools import partial
from typing import Callable, Mapping, cast

import strawberry

from phoenix.metrics import Metric
from phoenix.metrics.metrics import Cardinality, Count, Max, Mean, Min, PercentEmpty, Quantile, Sum


@strawberry.enum
class DataQualityMetric(Enum):
    cardinality = auto()
    percentEmpty = auto()
    mean = auto()
    sum = auto()
    min = auto()
    max = auto()
    count = auto()
    p01 = auto()
    p25 = auto()
    p50 = auto()
    p75 = auto()
    p99 = auto()


DATA_QUALITY_METRIC_FACTORIES: Mapping[DataQualityMetric, Callable[[], Metric]] = {
    DataQualityMetric.cardinality: cast(Callable[[], Metric], Cardinality),
    DataQualityMetric.percentEmpty: cast(Callable[[], Metric], PercentEmpty),
    DataQualityMetric.mean: cast(Callable[[], Metric], Mean),
    DataQualityMetric.sum: cast(Callable[[], Metric], Sum),
    DataQualityMetric.min: cast(Callable[[], Metric], Min),
    DataQualityMetric.max: cast(Callable[[], Metric], Max),
    DataQualityMetric.count: cast(Callable[[], Metric], Count),
    DataQualityMetric.p01: cast(Callable[[], Metric], partial(Quantile, probability=0.01)),
    DataQualityMetric.p25: cast(Callable[[], Metric], partial(Quantile, probability=0.25)),
    DataQualityMetric.p50: cast(Callable[[], Metric], partial(Quantile, probability=0.50)),
    DataQualityMetric.p75: cast(Callable[[], Metric], partial(Quantile, probability=0.75)),
    DataQualityMetric.p99: cast(Callable[[], Metric], partial(Quantile, probability=0.99)),
}
