import pytest

from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    ContinuousAnnotationConfig,
    OptimizationDirection,
)
from phoenix.server.api.evaluators import CodeEvaluatorRunner

CATEGORICAL_CONFIG = CategoricalAnnotationConfig(
    type="CATEGORICAL",
    name="quality",
    optimization_direction=OptimizationDirection.MAXIMIZE,
    values=[
        CategoricalAnnotationValue(label="good", score=1.0),
        CategoricalAnnotationValue(label="bad", score=0.0),
    ],
)

CONTINUOUS_CONFIG = ContinuousAnnotationConfig(
    type="CONTINUOUS",
    name="score",
    optimization_direction=OptimizationDirection.MAXIMIZE,
    lower_bound=0.0,
    upper_bound=1.0,
)

CONTINUOUS_CONFIG_NO_BOUNDS = ContinuousAnnotationConfig(
    type="CONTINUOUS",
    name="score",
    optimization_direction=OptimizationDirection.MAXIMIZE,
)

CONTINUOUS_CONFIG_LOWER_ONLY = ContinuousAnnotationConfig(
    type="CONTINUOUS",
    name="score",
    optimization_direction=OptimizationDirection.MAXIMIZE,
    lower_bound=0.0,
)

CONTINUOUS_CONFIG_UPPER_ONLY = ContinuousAnnotationConfig(
    type="CONTINUOUS",
    name="score",
    optimization_direction=OptimizationDirection.MAXIMIZE,
    upper_bound=1.0,
)


class TestCoerceOutputContinuousBareValues:
    """Bare float/int values accepted as score for continuous configs (D5)."""

    def test_bare_float(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(0.75, [CONTINUOUS_CONFIG])
        assert label is None
        assert score == 0.75
        assert explanation is None

    def test_bare_int(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(1, [CONTINUOUS_CONFIG])
        assert label is None
        assert score == 1.0
        assert explanation is None

    def test_bare_zero(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(0, [CONTINUOUS_CONFIG])
        assert label is None
        assert score == 0.0
        assert explanation is None

    def test_bare_negative(self) -> None:
        """Negative values accepted when no lower bound is set."""
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            -0.5, [CONTINUOUS_CONFIG_NO_BOUNDS]
        )
        assert label is None
        assert score == -0.5
        assert explanation is None


class TestCoerceOutputContinuousDictCompat:
    """Dict returns with explicit keys still work for continuous configs."""

    def test_dict_score(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            {"score": 0.85}, [CONTINUOUS_CONFIG]
        )
        assert label is None
        assert score == 0.85
        assert explanation is None

    def test_dict_score_with_explanation(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            {"score": 0.85, "explanation": "looks great"}, [CONTINUOUS_CONFIG]
        )
        assert label is None
        assert score == 0.85
        assert explanation == "looks great"

    def test_dict_score_int(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            {"score": 1}, [CONTINUOUS_CONFIG]
        )
        assert label is None
        assert score == 1.0


class TestCoerceOutputContinuousBoundsValidation:
    """Bounds validation raises ValueError (D7)."""

    def test_score_below_lower_bound(self) -> None:
        with pytest.raises(ValueError, match="out of bounds"):
            CodeEvaluatorRunner._coerce_output(-0.1, [CONTINUOUS_CONFIG])

    def test_score_above_upper_bound(self) -> None:
        with pytest.raises(ValueError, match="out of bounds"):
            CodeEvaluatorRunner._coerce_output(1.1, [CONTINUOUS_CONFIG])

    def test_score_at_lower_bound(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(0.0, [CONTINUOUS_CONFIG])
        assert score == 0.0

    def test_score_at_upper_bound(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(1.0, [CONTINUOUS_CONFIG])
        assert score == 1.0

    def test_no_bounds_allows_any_value(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            999.9, [CONTINUOUS_CONFIG_NO_BOUNDS]
        )
        assert score == 999.9

    def test_lower_bound_only(self) -> None:
        with pytest.raises(ValueError, match="out of bounds"):
            CodeEvaluatorRunner._coerce_output(-0.1, [CONTINUOUS_CONFIG_LOWER_ONLY])

    def test_lower_bound_only_no_upper_limit(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            999.9, [CONTINUOUS_CONFIG_LOWER_ONLY]
        )
        assert score == 999.9

    def test_upper_bound_only(self) -> None:
        with pytest.raises(ValueError, match="out of bounds"):
            CodeEvaluatorRunner._coerce_output(1.1, [CONTINUOUS_CONFIG_UPPER_ONLY])

    def test_upper_bound_only_no_lower_limit(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            -999.9, [CONTINUOUS_CONFIG_UPPER_ONLY]
        )
        assert score == -999.9

    def test_dict_score_below_lower_bound(self) -> None:
        with pytest.raises(ValueError, match="out of bounds"):
            CodeEvaluatorRunner._coerce_output({"score": -0.1}, [CONTINUOUS_CONFIG])

    def test_dict_score_above_upper_bound(self) -> None:
        with pytest.raises(ValueError, match="out of bounds"):
            CodeEvaluatorRunner._coerce_output({"score": 1.1}, [CONTINUOUS_CONFIG])


class TestCoerceOutputCategoricalBareValues:
    """Bare string values accepted as label for categorical configs (D5)."""

    def test_bare_string(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output("good", [CATEGORICAL_CONFIG])
        assert label == "good"
        assert score == 1.0
        assert explanation is None

    def test_bare_string_score_mapping(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output("bad", [CATEGORICAL_CONFIG])
        assert label == "bad"
        assert score == 0.0

    def test_bare_string_invalid_label(self) -> None:
        with pytest.raises(ValueError, match="not in allowed values"):
            CodeEvaluatorRunner._coerce_output("maybe", [CATEGORICAL_CONFIG])


class TestCoerceOutputCategoricalDictCompat:
    """Dict returns with explicit keys still work for categorical configs."""

    def test_dict_label(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            {"label": "good"}, [CATEGORICAL_CONFIG]
        )
        assert label == "good"
        assert score == 1.0
        assert explanation is None

    def test_dict_label_with_explanation(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            {"label": "bad", "explanation": "poor quality"}, [CATEGORICAL_CONFIG]
        )
        assert label == "bad"
        assert score == 0.0
        assert explanation == "poor quality"

    def test_dict_invalid_label(self) -> None:
        with pytest.raises(ValueError, match="not in allowed values"):
            CodeEvaluatorRunner._coerce_output({"label": "maybe"}, [CATEGORICAL_CONFIG])


class TestCoerceOutputBoolExcluded:
    """Bool explicitly excluded from bare numeric coercion (D6)."""

    def test_true_not_coerced_to_score(self) -> None:
        with pytest.raises(ValueError):
            CodeEvaluatorRunner._coerce_output(True, [CONTINUOUS_CONFIG])

    def test_false_not_coerced_to_score(self) -> None:
        with pytest.raises(ValueError):
            CodeEvaluatorRunner._coerce_output(False, [CONTINUOUS_CONFIG])


class TestCoerceOutputNoConfig:
    """Passthrough behavior when output_configs is empty."""

    def test_dict_all_fields(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            {"label": "ok", "score": 0.5, "explanation": "fine"}, []
        )
        assert label == "ok"
        assert score == 0.5
        assert explanation == "fine"

    def test_dict_score_only(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output({"score": 0.5}, [])
        assert label is None
        assert score == 0.5
        assert explanation is None

    def test_dict_label_only(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output({"label": "ok"}, [])
        assert label == "ok"
        assert score is None
        assert explanation is None

    def test_dict_non_string_label_ignored(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output({"label": 123}, [])
        assert label is None

    def test_dict_non_numeric_score_ignored(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            {"score": "not a number"}, []
        )
        assert score is None

    def test_explanation_non_string_ignored(self) -> None:
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            {"score": 1.0, "explanation": 42}, [CONTINUOUS_CONFIG_NO_BOUNDS]
        )
        assert explanation is None

    def test_bare_float_no_config(self) -> None:
        """Bare float in passthrough mode maps to score."""
        label, score, explanation = CodeEvaluatorRunner._coerce_output(0.5, [])
        assert label is None
        assert score == 0.5
        assert explanation is None

    def test_bare_string_no_config(self) -> None:
        """Bare string in passthrough mode maps to label."""
        label, score, explanation = CodeEvaluatorRunner._coerce_output("ok", [])
        assert label == "ok"
        assert score is None
        assert explanation is None

    def test_bare_bool_no_config(self) -> None:
        """Bare bool in passthrough mode is not coerced to score."""
        # Bool should not be treated as numeric (D6 applies in passthrough too)
        label, score, explanation = CodeEvaluatorRunner._coerce_output(True, [])
        assert score is None

    def test_none_no_config(self) -> None:
        """None in passthrough mode returns all None."""
        label, score, explanation = CodeEvaluatorRunner._coerce_output(None, [])
        assert label is None
        assert score is None
        assert explanation is None

    def test_explanation_only_dict_no_config(self) -> None:
        """Dict with only explanation in passthrough mode."""
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            {"explanation": "some rationale"}, []
        )
        assert label is None
        assert score is None
        assert explanation == "some rationale"

    def test_combined_dict_score_label_explanation_no_config(self) -> None:
        """Combined dict matching the generic template output format."""
        label, score, explanation = CodeEvaluatorRunner._coerce_output(
            {"score": 0.9, "label": "correct", "explanation": "The output is correct."}, []
        )
        assert label == "correct"
        assert score == 0.9
        assert explanation == "The output is correct."
