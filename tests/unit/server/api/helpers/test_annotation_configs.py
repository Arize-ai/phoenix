from phoenix.db.types.annotation_configs import (
    AnnotationConfigOverrideType,
    AnnotationConfigType,
    CategoricalAnnotationConfig,
    CategoricalAnnotationConfigOverride,
    CategoricalAnnotationValue,
    ContinuousAnnotationConfig,
    ContinuousAnnotationConfigOverride,
    OptimizationDirection,
)
from phoenix.server.api.helpers.annotation_configs import merge_configs_with_overrides


class TestMergeConfigsWithOverrides:
    def test_ignores_nonexistent_override(self) -> None:
        """Verify that overrides for config names that don't exist in
        base_configs are silently ignored and the base configs are
        returned unchanged."""
        base_configs: list[AnnotationConfigType] = [
            CategoricalAnnotationConfig(
                type="CATEGORICAL",
                name="correctness",
                description="Test",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                values=[
                    CategoricalAnnotationValue(label="good", score=1.0),
                    CategoricalAnnotationValue(label="bad", score=0.0),
                ],
            )
        ]
        overrides: dict[str, AnnotationConfigOverrideType] = {
            "nonexistent": CategoricalAnnotationConfigOverride(
                type="CATEGORICAL",
                optimization_direction=OptimizationDirection.MINIMIZE,
                values=None,
            ),
        }
        result = merge_configs_with_overrides(base_configs, overrides)
        assert len(result) == 1
        assert result[0] == base_configs[0]  # unchanged

    def test_matching_categorical_override_applied(self) -> None:
        base_configs: list[AnnotationConfigType] = [
            CategoricalAnnotationConfig(
                type="CATEGORICAL",
                name="correctness",
                description="Test",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                values=[
                    CategoricalAnnotationValue(label="good", score=1.0),
                    CategoricalAnnotationValue(label="bad", score=0.0),
                ],
            )
        ]
        overrides: dict[str, AnnotationConfigOverrideType] = {
            "correctness": CategoricalAnnotationConfigOverride(
                type="CATEGORICAL",
                optimization_direction=OptimizationDirection.MINIMIZE,
                values=None,
            ),
        }
        result = merge_configs_with_overrides(base_configs, overrides)
        assert len(result) == 1
        merged = result[0]
        assert isinstance(merged, CategoricalAnnotationConfig)
        base = base_configs[0]
        assert isinstance(base, CategoricalAnnotationConfig)
        assert merged.optimization_direction != base.optimization_direction

    def test_matching_continuous_override_applied(self) -> None:
        base_configs: list[AnnotationConfigType] = [
            ContinuousAnnotationConfig(
                type="CONTINUOUS",
                name="score",
                description="A score",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                lower_bound=0.0,
                upper_bound=1.0,
            )
        ]
        overrides: dict[str, AnnotationConfigOverrideType] = {
            "score": ContinuousAnnotationConfigOverride(
                type="CONTINUOUS",
                optimization_direction=OptimizationDirection.MINIMIZE,
                lower_bound=0.0,
                upper_bound=10.0,
            ),
        }
        result = merge_configs_with_overrides(base_configs, overrides)
        assert len(result) == 1
        merged = result[0]
        assert isinstance(merged, ContinuousAnnotationConfig)
        assert merged.optimization_direction != OptimizationDirection.MAXIMIZE
        assert merged.upper_bound == 10.0

    def test_partial_override(self) -> None:
        """Only some configs have matching overrides; others pass through unchanged."""
        cat_config = CategoricalAnnotationConfig(
            type="CATEGORICAL",
            name="correctness",
            description="Test",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            values=[
                CategoricalAnnotationValue(label="good", score=1.0),
                CategoricalAnnotationValue(label="bad", score=0.0),
            ],
        )
        cont_config = ContinuousAnnotationConfig(
            type="CONTINUOUS",
            name="score",
            description="A score",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            lower_bound=0.0,
            upper_bound=1.0,
        )
        base_configs: list[AnnotationConfigType] = [cat_config, cont_config]
        overrides: dict[str, AnnotationConfigOverrideType] = {
            "correctness": CategoricalAnnotationConfigOverride(
                type="CATEGORICAL",
                optimization_direction=OptimizationDirection.MINIMIZE,
                values=None,
            ),
        }
        result = merge_configs_with_overrides(base_configs, overrides)
        assert len(result) == 2
        assert isinstance(result[0], CategoricalAnnotationConfig)
        assert result[0].optimization_direction != cat_config.optimization_direction
        # second config unchanged
        assert result[1] == cont_config

    def test_empty_dict_and_none_return_base_unchanged(self) -> None:
        base_configs: list[AnnotationConfigType] = [
            CategoricalAnnotationConfig(
                type="CATEGORICAL",
                name="correctness",
                description="Test",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                values=[
                    CategoricalAnnotationValue(label="good", score=1.0),
                    CategoricalAnnotationValue(label="bad", score=0.0),
                ],
            )
        ]
        result_none = merge_configs_with_overrides(base_configs, None)
        assert result_none == list(base_configs)
        result_empty = merge_configs_with_overrides(base_configs, {})
        assert result_empty == list(base_configs)

    def test_order_preservation(self) -> None:
        configs: list[AnnotationConfigType] = [
            CategoricalAnnotationConfig(
                type="CATEGORICAL",
                name="alpha",
                description="first",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                values=[
                    CategoricalAnnotationValue(label="a", score=1.0),
                    CategoricalAnnotationValue(label="b", score=0.0),
                ],
            ),
            ContinuousAnnotationConfig(
                type="CONTINUOUS",
                name="beta",
                description="second",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                lower_bound=0.0,
                upper_bound=1.0,
            ),
            CategoricalAnnotationConfig(
                type="CATEGORICAL",
                name="gamma",
                description="third",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                values=[
                    CategoricalAnnotationValue(label="x", score=1.0),
                    CategoricalAnnotationValue(label="y", score=0.0),
                ],
            ),
        ]
        overrides: dict[str, AnnotationConfigOverrideType] = {
            "gamma": CategoricalAnnotationConfigOverride(
                type="CATEGORICAL",
                optimization_direction=OptimizationDirection.MINIMIZE,
                values=None,
            ),
        }
        result = merge_configs_with_overrides(configs, overrides)
        assert len(result) == 3
        assert result[0].name == "alpha"
        assert result[1].name == "beta"
        assert result[2].name == "gamma"
