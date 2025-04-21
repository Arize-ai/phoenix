from enum import Enum
from typing import Annotated, Literal, Optional, Union

from pydantic import Field, RootModel
from typing_extensions import TypeAlias

from .db_models import DBBaseModel


class AnnotationType(Enum):
    CATEGORICAL = "CATEGORICAL"
    CONTINUOUS = "CONTINUOUS"
    FREEFORM = "FREEFORM"


class OptimizationDirection(Enum):
    MINIMIZE = "MINIMIZE"
    MAXIMIZE = "MAXIMIZE"


class _BaseAnnotationConfig(DBBaseModel):
    description: Optional[str] = None


class CategoricalAnnotationValue(DBBaseModel):
    label: str
    score: float


class CategoricalAnnotationConfig(_BaseAnnotationConfig):
    type: Literal[AnnotationType.CATEGORICAL.value]  # type: ignore[name-defined]
    optimization_direction: OptimizationDirection
    values: list[CategoricalAnnotationValue]


class ContinuousAnnotationConfig(_BaseAnnotationConfig):
    type: Literal[AnnotationType.CONTINUOUS.value]  # type: ignore[name-defined]
    optimization_direction: OptimizationDirection
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


class FreeformAnnotationConfig(_BaseAnnotationConfig):
    type: Literal[AnnotationType.FREEFORM.value]  # type: ignore[name-defined]


AnnotationConfigType: TypeAlias = Annotated[
    Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig],
    Field(..., discriminator="type"),
]


class AnnotationConfig(RootModel[AnnotationConfigType]):
    root: AnnotationConfigType
