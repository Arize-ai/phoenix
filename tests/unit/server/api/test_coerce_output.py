"""Tests for _coerce_output in coerce_output.py.

Covers all three modes:
1. Bare passthrough (output_config=None)
2. CategoricalOutputConfig — label validation + score lookup
3. ContinuousOutputConfig — numeric extraction + bounds validation

Also covers the D6 bool-exclusion rule throughout.
"""

from __future__ import annotations

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
        label, score = _coerce_output(42, None)
        assert label is None
        assert score == pytest.approx(42.0)

    def test_float_returns_score(self) -> None:
        label, score = _coerce_output(0.5, None)
        assert score == pytest.approx(0.5)

    def test_str_returns_label(self) -> None:
        label, score = _coerce_output("pass", None)
        assert label == "pass"
        assert score is None

    def test_none_returns_none_none(self) -> None:
        label, score = _coerce_output(None, None)
        assert label is None
        assert score is None

    def test_bool_is_not_numeric_returns_label(self) -> None:
        label, score = _coerce_output(True, None)
        assert label == "True"
        assert score is None

    def test_bool_false_returns_label(self) -> None:
        label, score = _coerce_output(False, None)
        assert label == "False"
        assert score is None

    def test_dict_returns_stringified_label(self) -> None:
        label, score = _coerce_output({"x": 1}, None)
        assert label is not None
        assert score is None


class TestCategoricalCoerce:
    def test_valid_label_returns_label_and_score(self) -> None:
        label, score = _coerce_output("pass", _cat())
        assert label == "pass"
        assert score == pytest.approx(1.0)

    def test_valid_label_fail_returns_score_zero(self) -> None:
        label, score = _coerce_output("fail", _cat())
        assert label == "fail"
        assert score == pytest.approx(0.0)

    def test_invalid_label_raises(self) -> None:
        with pytest.raises(ValueError, match="not in categorical"):
            _coerce_output("unknown", _cat())

    def test_numeric_value_raises(self) -> None:
        with pytest.raises(ValueError, match="Expected a string label"):
            _coerce_output(1, _cat())

    def test_none_raises(self) -> None:
        with pytest.raises(ValueError, match="Expected a string label"):
            _coerce_output(None, _cat())

    def test_bool_exclusion_stringified_and_validated(self) -> None:
        # True → "True"; only valid if "True" is a configured label
        cat_with_true = _cat([("True", 1.0), ("False", 0.0)])
        label, score = _coerce_output(True, cat_with_true)
        assert label == "True"

    def test_bool_exclusion_invalid_label_raises(self) -> None:
        # True → "True" but "True" is not in pass/fail config
        with pytest.raises(ValueError, match="not in categorical"):
            _coerce_output(True, _cat())

    def test_label_score_can_be_none(self) -> None:
        cat = _cat([("maybe", None)])  # type: ignore[list-item]
        label, score = _coerce_output("maybe", cat)
        assert label == "maybe"
        assert score is None


class TestContinuousCoerce:
    def test_int_returns_score(self) -> None:
        label, score = _coerce_output(1, _cont())
        assert label is None
        assert score == pytest.approx(1.0)

    def test_float_returns_score(self) -> None:
        label, score = _coerce_output(0.75, _cont())
        assert score == pytest.approx(0.75)

    def test_bool_raises(self) -> None:
        with pytest.raises(ValueError, match="got bool"):
            _coerce_output(True, _cont())

    def test_str_raises(self) -> None:
        with pytest.raises(ValueError, match="Expected a numeric value"):
            _coerce_output("0.5", _cont())

    def test_none_raises(self) -> None:
        with pytest.raises(ValueError, match="Expected a numeric value"):
            _coerce_output(None, _cont())

    def test_below_lower_bound_raises(self) -> None:
        with pytest.raises(ValueError, match="below lower_bound"):
            _coerce_output(-0.1, _cont(lower_bound=0.0))

    def test_above_upper_bound_raises(self) -> None:
        with pytest.raises(ValueError, match="above upper_bound"):
            _coerce_output(1.1, _cont(upper_bound=1.0))

    def test_at_lower_bound_is_valid(self) -> None:
        _, score = _coerce_output(0.0, _cont(lower_bound=0.0))
        assert score == pytest.approx(0.0)

    def test_at_upper_bound_is_valid(self) -> None:
        _, score = _coerce_output(1.0, _cont(upper_bound=1.0))
        assert score == pytest.approx(1.0)

    def test_no_bounds_accepts_any_numeric(self) -> None:
        _, score = _coerce_output(-999.0, _cont())
        assert score == pytest.approx(-999.0)
