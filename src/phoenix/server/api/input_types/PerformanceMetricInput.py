import inspect
from dataclasses import field, replace
from typing import KeysView, Optional

import strawberry
from strawberry import UNSET

from phoenix.core.model_schema import Column
from phoenix.metrics.mixins import EvaluationMetric, EvaluationMetricKeywordParameters
from phoenix.server.api.types.PerformanceMetric import PerformanceMetric


@strawberry.input
class MetricParametersInput:
    pos_label_str: Optional[str] = UNSET
    pos_label_bool: Optional[bool] = UNSET
    pos_label_int: Optional[int] = UNSET
    sample_weight_column_name: Optional[str] = UNSET

    parameters: strawberry.Private[EvaluationMetricKeywordParameters] = field(
        init=False,
        repr=False,
    )

    def __post_init__(self) -> None:
        parameters = EvaluationMetricKeywordParameters()

        if (
            isinstance(self.sample_weight_column_name, str)
            and self.sample_weight_column_name.strip()
        ):
            parameters = replace(
                parameters,
                sample_weight=Column(self.sample_weight_column_name),
            )

        if isinstance(self.pos_label_str, str) and self.pos_label_str.strip():
            parameters = replace(
                parameters,
                pos_label=self.pos_label_str,
            )
        elif isinstance(self.pos_label_bool, bool):
            parameters = replace(
                parameters,
                pos_label=self.pos_label_bool,
            )
        elif isinstance(self.pos_label_int, int):
            parameters = replace(
                parameters,
                pos_label=self.pos_label_int,
            )

        self.parameters = parameters

    def intersect(
        self,
        valid_parameters: KeysView[str],
    ) -> EvaluationMetricKeywordParameters:
        return replace(
            self.parameters,
            **{k: None for k in self.parameters.keys() - valid_parameters},
        )


@strawberry.input
class PerformanceMetricInput:
    metric: PerformanceMetric

    predicted_column_name: str
    actual_column_name: str

    parameters: Optional[MetricParametersInput] = UNSET

    metric_instance: strawberry.Private[EvaluationMetric] = field(
        init=False,
        repr=False,
    )

    def __post_init__(self) -> None:
        parameters = (
            validate(
                self.parameters,
                inspect.signature(self.metric.value),
            )
            if isinstance(self.parameters, MetricParametersInput)
            else EvaluationMetricKeywordParameters()
        )
        actual = Column(self.actual_column_name)
        predicted = Column(self.predicted_column_name)
        self.metric_instance = EvaluationMetric(
            actual=actual,
            predicted=predicted,
            eval=self.metric.value,
            parameters=parameters,
        )


def validate(
    parameters_input: MetricParametersInput,
    signature: inspect.Signature,
) -> EvaluationMetricKeywordParameters:
    valid_parameters = signature.parameters.keys()
    parameters = parameters_input.intersect(valid_parameters)
    if "pos_label" in valid_parameters and parameters.pos_label is None:
        raise ValueError("missing pos_label")
    return parameters
