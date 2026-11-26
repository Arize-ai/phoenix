import pytest

from phoenix.evals.metrics import exact_match


class TestExactMatch:
    @pytest.mark.parametrize(
        "output, expected, expected_score",
        [
            pytest.param("yes", "yes", 1.0, id="match"),
            pytest.param("no", "yes", 0.0, id="no-match"),
            pytest.param("Yes", "yes", 0.0, id="case-sensitive"),
            pytest.param(" yes", "yes", 0.0, id="no-normalization"),
        ],
    )
    def test_scores_exact_equality(self, output: str, expected: str, expected_score: float) -> None:
        (score,) = exact_match.evaluate({"output": output, "expected": expected})
        assert score.score == expected_score
        assert score.name == "exact_match"
        assert score.kind == "code"
        assert score.direction == "maximize"

    def test_input_mapping_remaps_keys(self) -> None:
        """The second docstring example: remap caller keys onto the evaluator's fields."""
        (score,) = exact_match.evaluate(
            {"prediction": "yes", "gold": "yes"},
            input_mapping={"output": "prediction", "expected": "gold"},
        )
        assert score.score == 1.0

    @pytest.mark.parametrize("output, expected", [("yes", "yes"), ("no", "yes")])
    def test_label_is_unset(self, output: str, expected: str) -> None:
        """`exact_match` reports only a numeric score, so `label` stays None.

        Pinned because the docstring examples previously claimed a boolean label.
        """
        (score,) = exact_match.evaluate({"output": output, "expected": expected})
        assert score.label is None
        assert score.explanation is None
