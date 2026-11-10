import json
from contextlib import nullcontext
from typing import Any, ContextManager

import pytest

from phoenix.db.types.annotation_configs import (
    AnnotationConfig,
    AnnotationType,
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    ContinuousAnnotationConfig,
    OptimizationDirection,
    OutputConfig,
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


class TestAsOutputConfigs:
    """as_output_configs re-validates base annotation-config models (the shape
    _AnnotationConfigList columns deserialize to) into OutputConfig subclasses."""

    def test_base_models_revalidate_into_output_configs(self) -> None:
        from phoenix.db.types.annotation_configs import (
            AnnotationConfigType,
            ContinuousOutputConfig,
            FreeformAnnotationConfig,
            FreeformOutputConfig,
            as_output_configs,
        )

        base_configs: list[AnnotationConfigType] = [
            ContinuousAnnotationConfig(
                type=AnnotationType.CONTINUOUS.value,
                name="score",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                lower_bound=0.0,
                upper_bound=1.0,
            ),
            FreeformAnnotationConfig(
                type=AnnotationType.FREEFORM.value,
                name="notes",
            ),
        ]
        output_configs = as_output_configs(base_configs)
        assert len(output_configs) == 2
        continuous, freeform = output_configs
        assert isinstance(continuous, ContinuousOutputConfig)
        assert continuous.name == "score"
        assert continuous.optimization_direction is OptimizationDirection.MAXIMIZE
        assert continuous.lower_bound == 0.0
        assert continuous.upper_bound == 1.0
        assert isinstance(freeform, FreeformOutputConfig)
        assert freeform.name == "notes"

    def test_nameless_configs_are_skipped(self) -> None:
        from phoenix.db.types.annotation_configs import as_output_configs

        nameless = ContinuousAnnotationConfig(
            type=AnnotationType.CONTINUOUS.value,
            optimization_direction=OptimizationDirection.MAXIMIZE,
        )
        assert as_output_configs([nameless]) == []

    def test_output_config_instances_pass_through(self) -> None:
        from phoenix.db.types.annotation_configs import (
            CategoricalOutputConfig,
            as_output_configs,
        )

        config = CategoricalOutputConfig(
            type=AnnotationType.CATEGORICAL.value,
            name="verdict",
            optimization_direction=OptimizationDirection.MINIMIZE,
            values=[CategoricalAnnotationValue(label="good", score=1.0)],
        )
        assert as_output_configs([config]) == [config]

    def test_none_and_empty_input(self) -> None:
        from phoenix.db.types.annotation_configs import as_output_configs

        assert as_output_configs(None) == []
        assert as_output_configs([]) == []


class TestContinuousThreshold:
    def _config(self, **kwargs: Any) -> ContinuousAnnotationConfig:
        return ContinuousAnnotationConfig(
            type=AnnotationType.CONTINUOUS.value,
            optimization_direction=OptimizationDirection.MAXIMIZE,
            lower_bound=0,
            upper_bound=10,
            **kwargs,
        )

    def test_threshold_inside_the_bounds_is_saved(self) -> None:
        config = self._config(threshold=7)
        assert config.threshold == 7
        assert config.model_dump()["threshold"] == 7

    @pytest.mark.parametrize(
        "kwargs, message",
        [
            pytest.param({"threshold": 0}, "greater than the lower bound", id="at-lower-bound"),
            pytest.param({"threshold": -1}, "greater than the lower bound", id="below-lower"),
            pytest.param({"threshold": 10}, "less than the upper bound", id="at-upper-bound"),
            pytest.param({"threshold": 11}, "less than the upper bound", id="above-upper"),
            pytest.param({"threshold": float("nan")}, "finite number", id="nan"),
            pytest.param({"threshold": float("inf")}, "finite number", id="infinite"),
        ],
    )
    def test_threshold_outside_the_bounds_is_rejected(
        self, kwargs: dict[str, Any], message: str
    ) -> None:
        with pytest.raises(ValueError, match=message):
            self._config(**kwargs)

    def test_threshold_needs_only_the_bounds_that_are_set(self) -> None:
        config = ContinuousAnnotationConfig(
            type=AnnotationType.CONTINUOUS.value,
            optimization_direction=OptimizationDirection.MINIMIZE,
            lower_bound=0,
            threshold=1000,
        )
        assert config.threshold == 1000
        with pytest.raises(ValueError, match="greater than the lower bound"):
            ContinuousAnnotationConfig(
                type=AnnotationType.CONTINUOUS.value,
                optimization_direction=OptimizationDirection.MINIMIZE,
                lower_bound=0,
                threshold=-1,
            )

    @pytest.mark.parametrize(
        "stored",
        [
            pytest.param(
                {
                    "type": "CONTINUOUS",
                    "optimization_direction": "MAXIMIZE",
                    "lower_bound": 0.0,
                    "upper_bound": 10.0,
                },
                id="with-bounds",
            ),
            pytest.param(
                {
                    "description": None,
                    "type": "CONTINUOUS",
                    "optimization_direction": "NONE",
                    "lower_bound": None,
                    "upper_bound": None,
                },
                id="null-bounds",
            ),
            pytest.param(
                {
                    "name": "score",
                    "type": "CONTINUOUS",
                    "optimization_direction": "MINIMIZE",
                    "lower_bound": 1.0,
                    "upper_bound": 5.0,
                },
                id="named-output-config",
            ),
        ],
    )
    def test_configs_without_a_threshold_serialize_byte_for_byte_as_before(
        self, stored: dict[str, Any]
    ) -> None:
        # Configs live in JSON columns with no migration: an unset threshold must
        # never appear when existing rows are read and written back.
        model = OutputConfig if "name" in stored else AnnotationConfig
        config = model.model_validate(stored).root
        assert isinstance(config, ContinuousAnnotationConfig)
        assert config.threshold is None
        assert "threshold" not in config.model_dump()
        assert json.dumps(config.model_dump(mode="json")) == json.dumps(stored)
