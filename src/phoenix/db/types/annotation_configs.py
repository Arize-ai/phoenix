from enum import Enum
from typing import Annotated, Literal, Optional, Union

from pydantic import AfterValidator, Field, RootModel, model_validator
from typing_extensions import Self, TypeAlias

from .db_models import DBBaseModel


class AnnotationType(Enum):
    CATEGORICAL = "CATEGORICAL"
    CONTINUOUS = "CONTINUOUS"
    FREEFORM = "FREEFORM"


class OptimizationDirection(Enum):
    MINIMIZE = "MINIMIZE"
    MAXIMIZE = "MAXIMIZE"
    NONE = "NONE"


class _BaseAnnotationConfig(DBBaseModel):
    description: Optional[str] = None


def _categorical_value_label_is_non_empty_string(label: str) -> str:
    if not label:
        raise ValueError("Label must be non-empty")
    return label


class CategoricalAnnotationValue(DBBaseModel):
    label: Annotated[str, AfterValidator(_categorical_value_label_is_non_empty_string)]
    score: Optional[float] = None


def _categorical_values_are_non_empty_list(
    values: list[CategoricalAnnotationValue],
) -> list[CategoricalAnnotationValue]:
    if not values:
        raise ValueError("Values must be non-empty")
    return values


def _categorical_values_have_unique_labels(
    values: list[CategoricalAnnotationValue],
) -> list[CategoricalAnnotationValue]:
    labels = set()
    for value in values:
        label = value.label
        if label in labels:
            raise ValueError(
                f'Values for categorical annotation config has duplicate label: "{label}"'
            )
        labels.add(label)
    return values


class CategoricalAnnotationConfig(_BaseAnnotationConfig):
    type: Literal[AnnotationType.CATEGORICAL.value]  # type: ignore[name-defined]
    optimization_direction: OptimizationDirection
    values: Annotated[
        list[CategoricalAnnotationValue],
        AfterValidator(_categorical_values_are_non_empty_list),
        AfterValidator(_categorical_values_have_unique_labels),
    ]


class ContinuousAnnotationConfig(_BaseAnnotationConfig):
    type: Literal[AnnotationType.CONTINUOUS.value]  # type: ignore[name-defined]
    optimization_direction: OptimizationDirection
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None

    @model_validator(mode="after")
    def check_bounds(self) -> Self:
        if (
            self.lower_bound is not None
            and self.upper_bound is not None
            and self.lower_bound >= self.upper_bound
        ):
            raise ValueError("Lower bound must be strictly less than upper bound")
        return self


class FreeformAnnotationConfig(_BaseAnnotationConfig):
    type: Literal[AnnotationType.FREEFORM.value]  # type: ignore[name-defined]


AnnotationConfigType: TypeAlias = Annotated[
    Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig],
    Field(..., discriminator="type"),
]


class AnnotationConfig(RootModel[AnnotationConfigType]):
    root: AnnotationConfigType
