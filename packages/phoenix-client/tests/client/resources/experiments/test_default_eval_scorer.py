"""Unit tests for _default_eval_scorer: the canonical evaluator-result normalizer.

These lock in the return-shape contract for ``create_evaluator``-wrapped functions, the
shared scorer also used by ``run_experiment``. A 2-tuple is (score, label) and a 3-tuple is
(score, label, explanation) — changing the 2-tuple mapping is a breaking change for existing
``run_experiment`` evaluators, so it stays put.
"""

from __future__ import annotations

import pytest

from phoenix.client.resources.experiments.evaluators import (
    _default_eval_scorer,  # pyright: ignore[reportPrivateUsage]
)


class TestDefaultEvalScorer:
    def test_bool_is_score_and_label(self) -> None:
        assert _default_eval_scorer(True) == {"score": 1.0, "label": "True"}

    def test_float_is_score(self) -> None:
        assert _default_eval_scorer(0.75) == {"score": 0.75}

    def test_int_is_score(self) -> None:
        assert _default_eval_scorer(1) == {"score": 1.0}

    def test_str_is_label(self) -> None:
        assert _default_eval_scorer("positive") == {"label": "positive"}

    def test_two_tuple_is_score_and_label(self) -> None:
        # Regression guard: a 2-tuple is (score, label). This is shared with run_experiment;
        # remapping the second element to "explanation" silently breaks existing evaluators.
        assert _default_eval_scorer((0.9, "close enough")) == {
            "score": 0.9,
            "label": "close enough",
        }

    def test_three_tuple_is_score_label_explanation(self) -> None:
        assert _default_eval_scorer((1.0, "pass", "exact match")) == {
            "score": 1.0,
            "label": "pass",
            "explanation": "exact match",
        }

    def test_dict_passes_through(self) -> None:
        result = {"name": "correctness", "score": 1.0, "label": "pass"}
        assert _default_eval_scorer(result) == result

    def test_list_of_dicts_passes_through(self) -> None:
        result = [{"score": 1.0}, {"score": 0.0}]
        assert _default_eval_scorer(result) == result

    def test_unsupported_type_raises(self) -> None:
        with pytest.raises(ValueError):
            _default_eval_scorer(object())
