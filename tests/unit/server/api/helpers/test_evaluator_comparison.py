from datetime import datetime

import pytest

from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OptimizationDirection,
)
from phoenix.server.api.helpers.evaluator_comparison import (
    FLAGGED_LABEL,
    OTHER_LABEL,
    UNFLAGGED_LABEL,
    ComparisonAccumulator,
    cohens_kappa,
    make_side_binning,
    spearman_rho,
)


def _categorical_config(
    name: str = "verdict",
    direction: OptimizationDirection = OptimizationDirection.MAXIMIZE,
    values: list[tuple[str, float]] = [("pass", 1.0), ("fail", 0.0)],
) -> CategoricalOutputConfig:
    return CategoricalOutputConfig(
        type="CATEGORICAL",
        name=name,
        optimization_direction=direction,
        values=[CategoricalAnnotationValue(label=label, score=score) for label, score in values],
    )


def _continuous_config(
    name: str = "score",
    direction: OptimizationDirection = OptimizationDirection.MINIMIZE,
) -> ContinuousOutputConfig:
    return ContinuousOutputConfig(
        type="CONTINUOUS",
        name=name,
        optimization_direction=direction,
        lower_bound=0.0,
        upper_bound=1.0,
    )


class TestMakeSideBinning:
    def test_continuous_minimize_flags_at_or_above_threshold(self) -> None:
        binning = make_side_binning("toxicity", _continuous_config(), None)
        assert binning.is_thresholded
        assert binning.bin(None, 0.5) == FLAGGED_LABEL
        assert binning.bin(None, 0.49) == UNFLAGGED_LABEL
        assert binning.bin(None, None) is None

    def test_continuous_maximize_flags_at_or_below_threshold(self) -> None:
        config = _continuous_config(direction=OptimizationDirection.MAXIMIZE)
        binning = make_side_binning("correctness", config, None)
        assert binning.bin(None, 0.2) == FLAGGED_LABEL
        assert binning.bin(None, 0.5) == FLAGGED_LABEL  # at the pivot is not good
        assert binning.bin(None, 0.51) == UNFLAGGED_LABEL

    def test_pivot_falls_back_to_bounds_midpoint(self) -> None:
        config = ContinuousOutputConfig(
            type="CONTINUOUS",
            name="rating",
            optimization_direction=OptimizationDirection.MINIMIZE,
            lower_bound=1.0,
            upper_bound=5.0,
        )
        binning = make_side_binning("rating", config, None)
        assert binning.threshold == pytest.approx(3.0)
        assert binning.bin(None, 3.0) == FLAGGED_LABEL
        assert binning.bin(None, 2.9) == UNFLAGGED_LABEL

    def test_categorical_label_at_pivot_is_never_flagged(self) -> None:
        config = _categorical_config(
            direction=OptimizationDirection.MAXIMIZE,
            values=[("high", 1.0), ("mid", 0.5), ("low", 0.0)],
        )
        binning = make_side_binning("verdict", config, None)
        # Pivot is the midpoint of the value scores (0.5); "mid" sits on it.
        assert binning.threshold == pytest.approx(0.5)
        assert binning.flagged_label_set == frozenset({"low"})

    def test_missing_config_defaults_to_flag_at_or_above_half(self) -> None:
        binning = make_side_binning("mystery", None, None)
        assert binning.is_thresholded
        assert binning.threshold == 0.5
        assert binning.bin(None, 0.7) == FLAGGED_LABEL

    def test_threshold_override_rebins(self) -> None:
        binning = make_side_binning("toxicity", _continuous_config(), 0.8)
        assert binning.bin(None, 0.7) == UNFLAGGED_LABEL
        assert binning.bin(None, 0.85) == FLAGGED_LABEL

    def test_categorical_flagged_labels_from_value_scores(self) -> None:
        binning = make_side_binning("verdict", _categorical_config(), None)
        assert not binning.is_thresholded
        assert binning.bin("fail", None) == "fail"
        assert binning.flagged_label_set == frozenset({"fail"})

    def test_categorical_without_direction_has_no_flag_semantics(self) -> None:
        config = _categorical_config(direction=OptimizationDirection.NONE)
        binning = make_side_binning("verdict", config, None)
        assert binning.flagged_label_set is None


class TestCohensKappa:
    def test_perfect_agreement(self) -> None:
        assert cohens_kappa([[5, 0], [0, 5]]) == pytest.approx(1.0)

    def test_chance_level_agreement_is_zero(self) -> None:
        assert cohens_kappa([[1, 1], [1, 1]]) == pytest.approx(0.0)

    def test_known_value(self) -> None:
        # Classic textbook example: p0 = 0.7, pe = 0.5 -> kappa = 0.4.
        assert cohens_kappa([[20, 5], [10, 15]]) == pytest.approx(0.4)

    def test_empty_table_is_undefined(self) -> None:
        assert cohens_kappa([[0, 0], [0, 0]]) is None

    def test_degenerate_marginals_are_undefined(self) -> None:
        assert cohens_kappa([[10, 0], [0, 0]]) is None


class TestSpearmanRho:
    def test_monotonic_relationship(self) -> None:
        pairs = [(0.1, 0.2), (0.4, 0.5), (0.9, 0.95)]
        assert spearman_rho(pairs) == pytest.approx(1.0)

    def test_inverse_relationship(self) -> None:
        pairs = [(0.1, 0.9), (0.5, 0.5), (0.9, 0.1)]
        assert spearman_rho(pairs) == pytest.approx(-1.0)

    def test_ties_use_average_ranks(self) -> None:
        pairs = [(0.1, 0.1), (0.1, 0.2), (0.5, 0.3), (0.9, 0.3)]
        rho = spearman_rho(pairs)
        assert rho is not None
        assert 0 < rho < 1

    def test_constant_side_is_undefined(self) -> None:
        assert spearman_rho([(0.5, 0.1), (0.5, 0.9)]) is None

    def test_fewer_than_two_pairs_is_undefined(self) -> None:
        assert spearman_rho([(0.5, 0.5)]) is None


class TestComparisonAccumulator:
    def test_binary_thresholded_comparison(self) -> None:
        binning_a = make_side_binning("toxicity", _continuous_config(), None)
        binning_b = make_side_binning("harm", _continuous_config(name="harm"), None)
        accumulator = ComparisonAccumulator(binning_a, binning_b)
        # n11=2, n10=1, n01=1, n00=4
        for score_a, score_b in [
            (0.9, 0.8),
            (0.7, 0.6),
            (0.8, 0.1),
            (0.2, 0.9),
            (0.1, 0.2),
            (0.0, 0.1),
            (0.3, 0.4),
            (0.2, 0.3),
        ]:
            accumulator.add(None, score_a, None, score_b)
        result = accumulator.result()
        assert result.n == 8
        assert result.side_a.labels == (FLAGGED_LABEL, UNFLAGGED_LABEL)
        assert result.matrix == ((2, 1), (1, 4))
        assert result.agreement == pytest.approx(6 / 8)
        assert result.disagreement_count == 2
        # p0 = 0.75, pe = (3*3 + 5*5)/64 = 34/64 -> kappa = (48-34)/(64-34)
        assert result.cohens_kappa == pytest.approx((0.75 - 34 / 64) / (1 - 34 / 64))
        assert result.spearman_rho is not None
        assert result.side_a.flagged_count == 3
        assert result.side_a.flag_rate == pytest.approx(3 / 8)
        assert result.side_b.flagged_count == 3
        assert result.side_a.threshold == 0.5

    def test_categorical_versus_thresholded(self) -> None:
        binning_a = make_side_binning("verdict", _categorical_config(), None)
        binning_b = make_side_binning("toxicity", _continuous_config(), None)
        accumulator = ComparisonAccumulator(binning_a, binning_b)
        accumulator.add("pass", 1.0, None, 0.1)  # not flagged / not flagged
        accumulator.add("fail", 0.0, None, 0.9)  # flagged / flagged
        accumulator.add("fail", 0.0, None, 0.2)  # flagged / not flagged
        accumulator.add("pass", 1.0, None, 0.8)  # not flagged / flagged
        result = accumulator.result()
        assert result.n == 4
        assert result.side_a.labels == ("pass", "fail")
        assert result.side_b.labels == (FLAGGED_LABEL, UNFLAGGED_LABEL)
        assert result.matrix == ((1, 1), (1, 1))
        assert result.agreement == pytest.approx(0.5)
        assert result.cohens_kappa == pytest.approx(0.0)
        assert result.disagreement_count == 2
        assert result.spearman_rho is None  # side A is categorical
        assert result.side_a.flagged_labels == ("fail",)
        assert result.side_a.flagged_count == 2
        assert result.side_a.mean_score == pytest.approx(0.5)
        assert result.side_b.mean_score == pytest.approx(0.5)

    def test_unbinnable_pairs_are_excluded(self) -> None:
        binning_a = make_side_binning("a", _continuous_config(name="a"), None)
        binning_b = make_side_binning("b", _continuous_config(name="b"), None)
        accumulator = ComparisonAccumulator(binning_a, binning_b)
        accumulator.add(None, 0.9, None, 0.8)
        accumulator.add(None, None, None, 0.8)  # no score on a thresholded side
        result = accumulator.result()
        assert result.n == 1

    def test_label_cap_folds_tail_into_other(self) -> None:
        config = _categorical_config(
            direction=OptimizationDirection.NONE,
            values=[(f"label_{index}", 0.0) for index in range(9)],
        )
        binning_a = make_side_binning("many", config, None)
        binning_b = make_side_binning("toxicity", _continuous_config(), None)
        accumulator = ComparisonAccumulator(binning_a, binning_b)
        for index in range(9):
            weight = 9 - index  # label_0 most frequent
            for _ in range(weight):
                accumulator.add(f"label_{index}", None, None, 0.9)
        result = accumulator.result()
        assert len(result.side_a.labels) == 7
        assert result.side_a.labels[-1] == OTHER_LABEL
        assert result.side_a.labels[0] == "label_0"
        assert result.n == sum(range(1, 10))
        assert sum(row[0] for row in result.matrix) == result.n

    def test_identical_label_sets_fall_back_to_label_equality(self) -> None:
        config = _categorical_config(direction=OptimizationDirection.NONE)
        binning_a = make_side_binning("a", config, None)
        binning_b = make_side_binning("b", config, None)
        accumulator = ComparisonAccumulator(binning_a, binning_b)
        accumulator.add("pass", None, "pass", None)
        accumulator.add("fail", None, "fail", None)
        accumulator.add("pass", None, "fail", None)
        result = accumulator.result()
        assert result.agreement == pytest.approx(2 / 3)
        assert result.disagreement_count == 1
        assert result.side_a.flagged_count is None
        assert result.side_a.flag_rate is None

    def test_disjoint_label_sets_without_flags_have_no_agreement(self) -> None:
        config_a = _categorical_config(
            direction=OptimizationDirection.NONE, values=[("harmful", 0.0), ("safe", 1.0)]
        )
        config_b = _categorical_config(
            direction=OptimizationDirection.NONE, values=[("profane", 0.0), ("clean", 1.0)]
        )
        binning_a = make_side_binning("a", config_a, None)
        binning_b = make_side_binning("b", config_b, None)
        accumulator = ComparisonAccumulator(binning_a, binning_b)
        accumulator.add("harmful", None, "profane", None)
        accumulator.add("safe", None, "clean", None)
        result = accumulator.result()
        assert result.n == 2
        assert result.agreement is None
        assert result.cohens_kappa is None
        assert result.disagreement_count is None

    def test_empty_population(self) -> None:
        binning_a = make_side_binning("a", _continuous_config(name="a"), None)
        binning_b = make_side_binning("b", _continuous_config(name="b"), None)
        result = ComparisonAccumulator(binning_a, binning_b).result()
        assert result.n == 0
        assert result.matrix == ((0, 0), (0, 0))
        assert result.agreement is None
        assert result.cohens_kappa is None
        assert result.spearman_rho is None
        assert result.side_a.mean_score is None


class TestComparisonTimeSeries:
    def test_per_bin_stats(self) -> None:
        hour_one = datetime.fromisoformat("2024-01-01T01:00:00+00:00")
        hour_two = datetime.fromisoformat("2024-01-01T02:00:00+00:00")
        binning_a = make_side_binning("a", _continuous_config(name="a"), None)
        binning_b = make_side_binning("b", _continuous_config(name="b"), None)
        accumulator = ComparisonAccumulator(binning_a, binning_b)
        accumulator.add(None, 0.9, None, 0.8, bucket=hour_one)  # agree (both flagged)
        accumulator.add(None, 0.1, None, 0.9, bucket=hour_one)  # disagree
        accumulator.add(None, 0.2, None, 0.1, bucket=hour_two)  # agree (both clear)
        result = accumulator.result()
        assert len(result.time_series) == 2
        first, second = result.time_series
        assert first.timestamp == hour_one
        assert first.evaluated_by_both == 2
        assert first.flag_rate_a == pytest.approx(0.5)
        assert first.flag_rate_b == pytest.approx(1.0)
        assert first.mean_score_a == pytest.approx(0.5)
        assert first.agreement == pytest.approx(0.5)
        assert second.evaluated_by_both == 1
        assert second.agreement == pytest.approx(1.0)

    def test_rows_without_bucket_do_not_produce_bins(self) -> None:
        binning_a = make_side_binning("a", _continuous_config(name="a"), None)
        binning_b = make_side_binning("b", _continuous_config(name="b"), None)
        accumulator = ComparisonAccumulator(binning_a, binning_b)
        accumulator.add(None, 0.9, None, 0.8)
        result = accumulator.result()
        assert result.n == 1
        assert result.time_series == ()

    def test_agreement_is_none_without_a_reduction(self) -> None:
        hour_one = datetime.fromisoformat("2024-01-01T01:00:00+00:00")
        config_a = _categorical_config(
            direction=OptimizationDirection.NONE, values=[("harmful", 0.0), ("safe", 1.0)]
        )
        config_b = _categorical_config(
            direction=OptimizationDirection.NONE, values=[("profane", 0.0), ("clean", 1.0)]
        )
        accumulator = ComparisonAccumulator(
            make_side_binning("a", config_a, None), make_side_binning("b", config_b, None)
        )
        accumulator.add("harmful", None, "profane", None, bucket=hour_one)
        (point,) = accumulator.result().time_series
        assert point.agreement is None
        assert point.flag_rate_a is None


class TestScoreBinCounts:
    def test_thresholded_sides_get_histograms(self) -> None:
        binning_a = make_side_binning("a", _continuous_config(name="a"), None)
        binning_b = make_side_binning("b", _continuous_config(name="b"), None)
        accumulator = ComparisonAccumulator(binning_a, binning_b)
        for score_a, score_b in [(0.05, 0.95), (0.05, 0.95), (0.55, 0.15), (1.0, -0.2)]:
            accumulator.add(None, score_a, None, score_b)
        result = accumulator.result()
        assert result.side_a.score_bin_counts == (2, 0, 0, 0, 0, 1, 0, 0, 0, 1)
        assert result.side_b.score_bin_counts == (1, 1, 0, 0, 0, 0, 0, 0, 0, 2)

    def test_categorical_side_has_no_histogram(self) -> None:
        binning_a = make_side_binning("a", _categorical_config(), None)
        binning_b = make_side_binning("b", _continuous_config(name="b"), None)
        accumulator = ComparisonAccumulator(binning_a, binning_b)
        accumulator.add("pass", 1.0, None, 0.4)
        result = accumulator.result()
        assert result.side_a.score_bin_counts is None
        assert result.side_b.score_bin_counts is not None
