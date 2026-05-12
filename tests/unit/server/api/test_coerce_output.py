"""Tests for _coerce_output in coerce_output.py.

Covers all three modes:
1. Bare passthrough (output_config=None)
2. CategoricalOutputConfig — label validation + score lookup
3. ContinuousOutputConfig — numeric extraction + bounds validation

Also covers the D6 bool-exclusion rule throughout, triple-collapse dict
acceptance, explanation passthrough, multi-output routing, and the new
no-config rejection of arbitrary dicts/lists.
"""

from __future__ import annotations

import math

import pytest

from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OptimizationDirection,
)
from phoenix.server.api.coerce_output import _coerce_output


def _cat(
    labels: list[tuple[str, float]] | None = None,
) -> CategoricalOutputConfig:
    if labels is None:
        labels = [("pass", 1.0), ("fail", 0.0)]
    return CategoricalOutputConfig(
        type="CATEGORICAL",
        name="score",
        optimization_direction=OptimizationDirection.MAXIMIZE,
        description="",
        values=[CategoricalAnnotationValue(label=lbl, score=s) for lbl, s in labels],
    )


def _cont(
    lower_bound: float | None = None,
    upper_bound: float | None = None,
) -> ContinuousOutputConfig:
    return ContinuousOutputConfig(
        type="CONTINUOUS",
        name="score",
        optimization_direction=OptimizationDirection.MAXIMIZE,
        description="",
        lower_bound=lower_bound,
        upper_bound=upper_bound,
    )


class TestBarePassthrough:
    def test_int_returns_score(self) -> None:
        label, score, explanation = _coerce_output(42, None)
        assert label is None
        assert score == pytest.approx(42.0)
        assert explanation is None

    def test_float_returns_score(self) -> None:
        label, score, explanation = _coerce_output(0.5, None)
        assert score == pytest.approx(0.5)
        assert explanation is None

    def test_str_returns_label(self) -> None:
        label, score, explanation = _coerce_output("pass", None)
        assert label == "pass"
        assert score is None
        assert explanation is None

    def test_none_returns_none_none(self) -> None:
        label, score, explanation = _coerce_output(None, None)
        assert label is None
        assert score is None
        assert explanation is None

    def test_bool_is_not_numeric_returns_label(self) -> None:
        label, score, explanation = _coerce_output(True, None)
        assert label == "True"
        assert score is None

    def test_bool_false_returns_label(self) -> None:
        label, score, explanation = _coerce_output(False, None)
        assert label == "False"
        assert score is None

    def test_arbitrary_dict_raises(self) -> None:
        with pytest.raises(ValueError, match="Unrecognized keys"):
            _coerce_output({"x": 1}, None)

    def test_list_raises(self) -> None:
        with pytest.raises(ValueError, match="Unsupported output type"):
            _coerce_output([1, 2, 3], None)

    def test_recognized_dict_label_key(self) -> None:
        label, score, explanation = _coerce_output({"label": "pass"}, None)
        assert label == "pass"
        assert score is None
        assert explanation is None

    def test_recognized_dict_score_key(self) -> None:
        label, score, explanation = _coerce_output({"score": 0.5}, None)
        assert label is None
        assert score == pytest.approx(0.5)

    def test_recognized_dict_explanation_key(self) -> None:
        label, score, explanation = _coerce_output({"explanation": "ok"}, None)
        assert explanation == "ok"

    def test_recognized_dict_all_keys(self) -> None:
        label, score, explanation = _coerce_output(
            {"label": "pass", "score": 0.5, "explanation": "good"}, None
        )
        assert label == "pass"
        assert score == pytest.approx(0.5)
        assert explanation == "good"


class TestCategoricalCoerce:
    def test_valid_label_returns_label_and_score(self) -> None:
        label, score, explanation = _coerce_output("pass", _cat())
        assert label == "pass"
        assert score == pytest.approx(1.0)
        assert explanation is None

    def test_valid_label_fail_returns_score_zero(self) -> None:
        label, score, explanation = _coerce_output("fail", _cat())
        assert label == "fail"
        assert score == pytest.approx(0.0)

    def test_invalid_label_raises(self) -> None:
        with pytest.raises(ValueError, match="not in categorical"):
            _coerce_output("unknown", _cat())

    def test_numeric_value_raises_label_required(self) -> None:
        with pytest.raises(ValueError, match="requires a label"):
            _coerce_output(1, _cat())

    def test_none_raises_label_required(self) -> None:
        with pytest.raises(ValueError, match="requires a label"):
            _coerce_output(None, _cat())

    def test_bool_exclusion_stringified_and_validated(self) -> None:
        cat_with_true = _cat([("True", 1.0), ("False", 0.0)])
        label, score, explanation = _coerce_output(True, cat_with_true)
        assert label == "True"

    def test_bool_exclusion_invalid_label_raises(self) -> None:
        with pytest.raises(ValueError, match="not in categorical"):
            _coerce_output(True, _cat())

    def test_label_score_can_be_none(self) -> None:
        cat = _cat([("maybe", None)])  # type: ignore[list-item]
        label, score, explanation = _coerce_output("maybe", cat)
        assert label == "maybe"
        assert score is None

    def test_none_canonical_score_falls_back_to_user_score(self) -> None:
        cat = _cat([("maybe", None)])  # type: ignore[list-item]
        label, score, explanation = _coerce_output({"label": "maybe", "score": 0.7}, cat)
        assert label == "maybe"
        assert score == pytest.approx(0.7)

    def test_none_canonical_score_rejects_bool_user_score(self) -> None:
        cat = _cat([("maybe", None)])  # type: ignore[list-item]
        with pytest.raises(ValueError, match="must not be bool"):
            _coerce_output({"label": "maybe", "score": True}, cat)

    def test_dict_with_label_key_accepted(self) -> None:
        label, score, explanation = _coerce_output({"label": "pass"}, _cat())
        assert label == "pass"
        assert score == pytest.approx(1.0)
        assert explanation is None

    def test_dict_with_label_and_explanation(self) -> None:
        label, score, explanation = _coerce_output(
            {"label": "pass", "explanation": "matched"}, _cat()
        )
        assert label == "pass"
        assert score == pytest.approx(1.0)
        assert explanation == "matched"

    def test_dict_score_matches_lookup_accepted(self) -> None:
        label, score, explanation = _coerce_output({"label": "pass", "score": 1.0}, _cat())
        assert label == "pass"
        assert score == pytest.approx(1.0)

    def test_dict_score_mismatch_raises(self) -> None:
        with pytest.raises(ValueError, match="does not match the configured score"):
            _coerce_output({"label": "pass", "score": 0.99}, _cat())

    def test_arbitrary_dict_raises(self) -> None:
        with pytest.raises(ValueError, match="Unrecognized keys"):
            _coerce_output({"x": 1}, _cat())

    def test_explanation_passthrough(self) -> None:
        label, score, explanation = _coerce_output(
            {"label": "fail", "explanation": "low confidence"}, _cat()
        )
        assert explanation == "low confidence"


class TestContinuousCoerce:
    def test_int_returns_score(self) -> None:
        label, score, explanation = _coerce_output(1, _cont())
        assert label is None
        assert score == pytest.approx(1.0)
        assert explanation is None

    def test_float_returns_score(self) -> None:
        label, score, explanation = _coerce_output(0.75, _cont())
        assert score == pytest.approx(0.75)

    def test_bool_raises(self) -> None:
        with pytest.raises(ValueError, match="got bool"):
            _coerce_output(True, _cont())

    def test_str_raises_score_required(self) -> None:
        with pytest.raises(ValueError, match="requires a numeric score"):
            _coerce_output("0.5", _cont())

    def test_none_raises_score_required(self) -> None:
        with pytest.raises(ValueError, match="requires a numeric score"):
            _coerce_output(None, _cont())

    def test_below_lower_bound_raises(self) -> None:
        with pytest.raises(ValueError, match="below lower_bound"):
            _coerce_output(-0.1, _cont(lower_bound=0.0))

    def test_above_upper_bound_raises(self) -> None:
        with pytest.raises(ValueError, match="above upper_bound"):
            _coerce_output(1.1, _cont(upper_bound=1.0))

    def test_at_lower_bound_is_valid(self) -> None:
        _, score, _ = _coerce_output(0.0, _cont(lower_bound=0.0))
        assert score == pytest.approx(0.0)

    def test_at_upper_bound_is_valid(self) -> None:
        _, score, _ = _coerce_output(1.0, _cont(upper_bound=1.0))
        assert score == pytest.approx(1.0)

    def test_no_bounds_accepts_any_numeric(self) -> None:
        _, score, _ = _coerce_output(-999.0, _cont())
        assert score == pytest.approx(-999.0)

    def test_nan_raises(self) -> None:
        with pytest.raises(ValueError, match="finite"):
            _coerce_output(math.nan, _cont())

    def test_infinity_raises(self) -> None:
        with pytest.raises(ValueError, match="finite"):
            _coerce_output(math.inf, _cont())

    def test_dict_with_score_key_accepted(self) -> None:
        label, score, explanation = _coerce_output({"score": 0.5}, _cont())
        assert label is None
        assert score == pytest.approx(0.5)
        assert explanation is None

    def test_dict_with_score_and_explanation(self) -> None:
        label, score, explanation = _coerce_output(
            {"score": 0.5, "explanation": "moderate confidence"}, _cont()
        )
        assert score == pytest.approx(0.5)
        assert explanation == "moderate confidence"

    def test_free_form_label_accepted(self) -> None:
        label, score, explanation = _coerce_output({"label": "high", "score": 0.9}, _cont())
        assert label == "high"
        assert score == pytest.approx(0.9)

    def test_arbitrary_dict_raises(self) -> None:
        with pytest.raises(ValueError, match="Unrecognized keys"):
            _coerce_output({"toxicity": 0.9}, _cont())

    def test_explanation_passthrough(self) -> None:
        _, _, explanation = _coerce_output({"score": 0.7, "explanation": "seems ok"}, _cont())
        assert explanation == "seems ok"


class TestShapeExamples:
    def test_categorical_shape_examples_contains_bare_label(self) -> None:
        config = _cat([("good", 1.0), ("bad", 0.0)])
        examples = config.shape_examples(language="PYTHON", mode="full")
        assert any("good" in ex for ex in examples)

    def test_categorical_shape_examples_no_tuples(self) -> None:
        config = _cat()
        examples = config.shape_examples(language="PYTHON", mode="full")
        assert not any("(" in ex and ")" in ex for ex in examples), (
            "Tuples must not appear in shape_examples per D5 deferral"
        )

    def test_categorical_shape_examples_typescript(self) -> None:
        config = _cat([("pass", 1.0), ("fail", 0.0)])
        examples = config.shape_examples(language="TYPESCRIPT", mode="full")
        assert all(ex.endswith(";") for ex in examples)

    def test_continuous_shape_examples_uses_midpoint(self) -> None:
        config = _cont(lower_bound=0.0, upper_bound=1.0)
        examples = config.shape_examples(language="PYTHON", mode="full")
        assert any("0.5" in ex for ex in examples)

    def test_continuous_shape_examples_no_tuples(self) -> None:
        config = _cont(lower_bound=0.0, upper_bound=10.0)
        examples = config.shape_examples(language="PYTHON", mode="full")
        assert not any("(" in ex and ")" in ex for ex in examples), (
            "Tuples must not appear in shape_examples per D5 deferral"
        )

    def test_continuous_shape_examples_includes_bounds_hint(self) -> None:
        config = _cont(lower_bound=0.0, upper_bound=10.0)
        examples = config.shape_examples(language="PYTHON", mode="full")
        # The dict form should include a bounds range comment
        full_text = "\n".join(examples)
        assert "0.0" in full_text and "10.0" in full_text

    def test_continuous_shape_examples_no_bounds_uses_fallback(self) -> None:
        config = _cont()
        examples = config.shape_examples(language="PYTHON", mode="full")
        assert any("0.5" in ex for ex in examples)

    def test_categorical_shape_examples_escapes_label_with_double_quote(self) -> None:
        """A label containing `"` must produce well-formed Python source.

        Naively interpolating ``f'"{label}"'`` for a label like ``pass"fail``
        yields ``return "pass"fail"`` — a SyntaxError. json.dumps escapes the
        embedded quote so the generated literal is valid Python (and TS).
        """
        config = _cat([('pass"fail', 1.0)])
        examples = config.shape_examples(language="PYTHON", mode="full")
        # Each example must be syntactically valid Python.
        import ast

        for ex in examples:
            ast.parse(ex)
        # And the bare-return example must contain the escaped form, not the
        # raw unescaped quote.
        bare = next(ex for ex in examples if ex.startswith("return "))
        assert '"pass\\"fail"' in bare, f"Expected escaped quote in {bare!r}"

    def test_categorical_shape_examples_escapes_label_with_backslash(self) -> None:
        """A label containing `\\` must not introduce an unintended escape sequence."""
        config = _cat([("a\\b", 1.0)])
        examples = config.shape_examples(language="PYTHON", mode="full")
        import ast

        for ex in examples:
            ast.parse(ex)
        # The literal value the generated Python returns must round-trip back
        # to the original label string.
        bare = next(ex for ex in examples if ex.startswith("return "))
        # Strip the "return " prefix and eval the literal.
        import ast as _ast

        returned = _ast.literal_eval(bare[len("return ") :].strip())
        assert returned == "a\\b"

    def test_categorical_shape_examples_typescript_escapes_label(self) -> None:
        """TypeScript variant must also produce a valid string literal."""
        config = _cat([('say "hi"', 1.0)])
        examples = config.shape_examples(language="TYPESCRIPT", mode="full")
        # JSON string literal syntax is valid TS string literal syntax, so
        # the escaped form must appear and the raw unescaped quote must not.
        bare = next(ex for ex in examples if ex.startswith("return "))
        assert '"say \\"hi\\""' in bare, f"Expected escaped quotes in {bare!r}"

    def test_categorical_shape_examples_curated_subset_of_full(self) -> None:
        config = _cat()
        full = config.shape_examples(mode="full")
        curated = config.shape_examples(mode="curated")
        # curated should not have more examples than full
        assert len(curated) <= len(full)

    def test_shape_examples_in_error_message(self) -> None:
        config = _cat([("pass", 1.0), ("fail", 0.0)])
        with pytest.raises(ValueError) as exc_info:
            _coerce_output("unknown", config)
        msg = str(exc_info.value)
        assert "Valid shapes" in msg
        assert "pass" in msg
