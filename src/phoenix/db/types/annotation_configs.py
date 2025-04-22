from enum import Enum
from typing import Annotated, Literal, Optional, Union

from pydantic import AfterValidator, Field, RootModel
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
    score: Optional[float] = None


def is_non_empty(values: list[CategoricalAnnotationValue]) -> list[CategoricalAnnotationValue]:
    if not values:
        raise ValueError("Values must be non-empty")
    return values


def has_unique_labels(values: list[CategoricalAnnotationValue]) -> list[CategoricalAnnotationValue]:
    labels = set()
    for value in values:
        label = value.label
        if label in labels:
            raise ValueError("Values for categorical annotation config must have unique labels")
        labels.add(label)
    return values


class CategoricalAnnotationConfig(_BaseAnnotationConfig):
    type: Literal[AnnotationType.CATEGORICAL.value]  # type: ignore[name-defined]
    optimization_direction: OptimizationDirection
    values: Annotated[
        list[CategoricalAnnotationValue],
        AfterValidator(is_non_empty),
        AfterValidator(has_unique_labels),
    ]


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
