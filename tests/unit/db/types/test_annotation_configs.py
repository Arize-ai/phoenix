from contextlib import nullcontext
from typing import Any, ContextManager

import pytest

from phoenix.db.types.annotation_configs import (
    AnnotationType,
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    ContinuousAnnotationConfig,
    OptimizationDirection,
)


@pytest.mark.parametrize(
    "values, expectation",
    (
        pytest.param(
            [
                CategoricalAnnotationValue(label="A", score=1.0),
            ],
            nullcontext(),
            id="valid-values-pass-validation",
        ),
        pytest.param(
            [],
            pytest.raises(ValueError, match="Values must be non-empty"),
            id="empty-values-raise-validation-error",
        ),
        pytest.param(
            [
                CategoricalAnnotationValue(label="A", score=1.0),
                CategoricalAnnotationValue(label="A", score=2.0),
            ],
            pytest.raises(
                ValueError,
                match='Values for categorical annotation config has duplicate label: "A"',
            ),
            id="duplicate-labels-raise-validation-error",
        ),
    ),
)
def test_categorical_annotation_config_correctly_validates_values(
    values: list[CategoricalAnnotationValue],
    expectation: ContextManager[Any],
) -> None:
    with expectation:
        CategoricalAnnotationConfig(
            type=AnnotationType.CATEGORICAL.value,
            values=values,
            optimization_direction=OptimizationDirection.MAXIMIZE,
        )


def test_cannot_create_categorical_annotation_config_with_empty_label() -> None:
    with pytest.raises(ValueError, match="Label must be non-empty"):
        CategoricalAnnotationConfig(
            type=AnnotationType.CATEGORICAL.value,
            values=[CategoricalAnnotationValue(label="", score=1.0)],
            optimization_direction=OptimizationDirection.MAXIMIZE,
        )


@pytest.mark.parametrize(
    ("lower_bound", "upper_bound"),
    [
        pytest.param(1.0, 0.0, id="lower-bound-greater-than-upper-bound"),
        pytest.param(1.0, 1.0, id="lower-bound-equals-upper-bound"),
    ],
)
def test_cannot_create_continuous_annotation_config_with_invalid_bounds(
    lower_bound: float, upper_bound: float
) -> None:
    with pytest.raises(ValueError, match="Lower bound must be strictly less than upper bound"):
        ContinuousAnnotationConfig(
            type=AnnotationType.CONTINUOUS.value,
            lower_bound=lower_bound,
            upper_bound=upper_bound,
            optimization_direction=OptimizationDirection.MAXIMIZE,
        )
