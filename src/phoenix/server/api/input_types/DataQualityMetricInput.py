from dataclasses import field, replace
from typing import Optional

import strawberry
from strawberry import UNSET
from typing_extensions import Annotated

from phoenix.core.model_schema import Column
from phoenix.metrics import Metric
from phoenix.metrics.mixins import UnaryOperator
from phoenix.server.api.types.DataQualityMetric import DataQualityMetric


@strawberry.input
class DataQualityMetricInput:
    metric: DataQualityMetric
    column_name: Annotated[
        Optional[str],
        strawberry.argument(
            description="When required by the metric, this is the name of the "
            "input column, e.g., to calculate mean, a specific column must be "
            "specified as input to be averaged over.",
        ),
    ] = UNSET

    metric_instance: strawberry.Private[Metric] = field(init=False)

    def __post_init__(self) -> None:
        metric_instance = self.metric.value()
        if isinstance(metric_instance, UnaryOperator):
            if not isinstance(self.column_name, str):
                raise ValueError(f"column name must not be null for {self.metric.name}")
            metric_instance = replace(
                metric_instance,
                operand=Column(self.column_name),
            )
        self.metric_instance = metric_instance
