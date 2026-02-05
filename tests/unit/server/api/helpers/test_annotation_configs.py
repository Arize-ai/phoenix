from phoenix.db.types.annotation_configs import (
    AnnotationConfigOverrideType,
    AnnotationConfigType,
    CategoricalAnnotationConfig,
    CategoricalAnnotationConfigOverride,
    CategoricalAnnotationValue,
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
