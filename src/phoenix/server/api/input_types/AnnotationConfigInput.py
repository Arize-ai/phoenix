from typing import Optional

import strawberry

from phoenix.db.types.annotation_configs import OptimizationDirection
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


@strawberry.input
class ContinuousAnnotationConfigInput:
    name: str
    description: Optional[str] = None
    optimization_direction: OptimizationDirection
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


@strawberry.input
class FreeformAnnotationConfigInput:
    name: str
    description: Optional[str] = None


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
