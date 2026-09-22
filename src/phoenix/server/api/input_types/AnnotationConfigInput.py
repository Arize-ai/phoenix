from typing import Optional

import strawberry

from phoenix.db.types.annotation_configs import (
    AnnotationType,
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    FreeformOutputConfig,
    OptimizationDirection,
    OutputConfigType,
)
from phoenix.server.api.exceptions import BadRequest


@strawberry.input
class CategoricalAnnotationConfigValueInput:
    label: str
    score: Optional[float] = None


@strawberry.input
class CategoricalAnnotationConfigInput:
    name: str
    description: Optional[str] = None
    optimization_direction: OptimizationDirection
    values: list[CategoricalAnnotationConfigValueInput]

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise BadRequest("Name cannot be empty")
        self.name = self.name.strip()


@strawberry.input
class ContinuousAnnotationConfigInput:
    name: str
    description: Optional[str] = None
    optimization_direction: OptimizationDirection
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise BadRequest("Name cannot be empty")
        self.name = self.name.strip()


@strawberry.input
class FreeformAnnotationConfigInput:
    name: str
    description: Optional[str] = None
    optimization_direction: Optional[OptimizationDirection] = None
    threshold: Optional[float] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise BadRequest("Name cannot be empty")
        self.name = self.name.strip()


@strawberry.input(one_of=True)
class AnnotationConfigInput:
    categorical: Optional[CategoricalAnnotationConfigInput] = strawberry.UNSET
    continuous: Optional[ContinuousAnnotationConfigInput] = strawberry.UNSET
    freeform: Optional[FreeformAnnotationConfigInput] = strawberry.UNSET

    def __post_init__(self) -> None:
        if (
            sum(
                [
                    self.categorical is not strawberry.UNSET,
                    self.continuous is not strawberry.UNSET,
                    self.freeform is not strawberry.UNSET,
                ]
            )
            != 1
        ):
            raise BadRequest("Exactly one of categorical, continuous, or freeform must be set")

    def to_output_config(self) -> OutputConfigType:
        """The evaluator output config this input describes, named as given."""
        if self.categorical is not None and self.categorical is not strawberry.UNSET:
            categorical = self.categorical
            return CategoricalOutputConfig(
                type=AnnotationType.CATEGORICAL.value,
                name=categorical.name,
                description=categorical.description,
                optimization_direction=categorical.optimization_direction,
                values=[
                    CategoricalAnnotationValue(label=value.label, score=value.score)
                    for value in categorical.values
                ],
            )
        if self.continuous is not None and self.continuous is not strawberry.UNSET:
            continuous = self.continuous
            return ContinuousOutputConfig(
                type=AnnotationType.CONTINUOUS.value,
                name=continuous.name,
                description=continuous.description,
                optimization_direction=continuous.optimization_direction,
                lower_bound=continuous.lower_bound,
                upper_bound=continuous.upper_bound,
            )
        if self.freeform is not None and self.freeform is not strawberry.UNSET:
            freeform = self.freeform
            return FreeformOutputConfig(
                type=AnnotationType.FREEFORM.value,
                name=freeform.name,
                description=freeform.description,
                optimization_direction=freeform.optimization_direction,
                thresholds=[freeform.threshold] if freeform.threshold is not None else None,
                lower_bound=freeform.lower_bound,
                upper_bound=freeform.upper_bound,
            )
        raise BadRequest("Invalid output config input")
