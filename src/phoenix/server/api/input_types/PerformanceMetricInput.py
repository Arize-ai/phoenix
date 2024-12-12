import strawberry

from phoenix.core.model_schema import ACTUAL_LABEL, PREDICTION_LABEL, Column, Model
from phoenix.metrics import Metric
from phoenix.metrics.mixins import EvaluationMetric
from phoenix.server.api.types.PerformanceMetric import (
    PERFORMANCE_METRIC_FUNCTIONS,
    PerformanceMetric,
)


@strawberry.input
class PerformanceMetricInput:
    metric: PerformanceMetric

    def metric_instance(self, model: Model) -> Metric:
        return EvaluationMetric(
            actual=Column(model[ACTUAL_LABEL].name),
            predicted=Column(model[PREDICTION_LABEL].name),
            eval=PERFORMANCE_METRIC_FUNCTIONS[self.metric],
        )
