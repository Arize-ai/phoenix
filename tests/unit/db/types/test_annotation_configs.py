from contextlib import nullcontext
from typing import Any, ContextManager

import pytest

from phoenix.db.types.annotation_configs import (
    AnnotationType,
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
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
                match="Values for categorical annotation config must have unique labels",
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
