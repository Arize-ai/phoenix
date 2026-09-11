import pytest

from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    FreeformOutputConfig,
    OptimizationDirection,
)
from phoenix.server.api.helpers.evaluator_distribution import DistributionAccumulator


def test_histogram_covers_outliers_and_excludes_missing_scores() -> None:
    config = ContinuousOutputConfig(
        type="CONTINUOUS",
        name="score",
        optimization_direction=OptimizationDirection.MINIMIZE,
        lower_bound=0,
        upper_bound=1,
    )
    accumulator = DistributionAccumulator(config, -1, 2, 5, [], 0)
    for score in [-1, 0, 0.5, 1, 2, None, float("inf"), float("nan")]:
        accumulator.add(None, score)
    result = accumulator.result()
    assert result.score_bin_edges is not None
    assert result.score_bin_edges[0] == -1
    assert result.score_bin_edges[-1] == 2
    assert result.score_bin_counts == [1, 0, 0, 1, 0, 1, 1, 0, 0, 1]
    assert result.all_evaluated_mean_score == pytest.approx(0.5)
    assert result.score_value_counts is None
    assert result.label_counts is None


def test_histogram_edges_put_boundary_scores_in_correct_bins() -> None:
    config = ContinuousOutputConfig(
        type="CONTINUOUS",
        name="score",
        lower_bound=0,
        upper_bound=1,
        optimization_direction=OptimizationDirection.NONE,
    )
    accumulator = DistributionAccumulator(config, 0, 1, 3, [], 0)
    for score in [0, 0.5, 1]:
        accumulator.add(None, score)
    assert accumulator.result().score_bin_counts == [1, 0, 0, 0, 0, 1, 0, 0, 0, 1]


def test_mixed_outputs_preserve_label_only_results() -> None:
    config = CategoricalOutputConfig(
        type="CATEGORICAL",
        name="quality",
        optimization_direction=OptimizationDirection.MAXIMIZE,
        values=[
            CategoricalAnnotationValue(label="pass", score=1),
            CategoricalAnnotationValue(label="fail", score=0),
        ],
    )
    accumulator = DistributionAccumulator(config, 0, 1, 2, ["fail", "pass"], 2)
    accumulator.add("pass", 1)
    accumulator.add("fail", None)
    accumulator.add("fail", 0)
    result = accumulator.result()
    assert result.score_bin_counts is result.score_bin_edges is None
    assert result.score_value_counts is not None
    assert [(point.score, point.count) for point in result.score_value_counts] == [(0, 1), (1, 1)]
    assert result.label_counts is not None
    assert [(point.label, point.score, point.count) for point in result.label_counts] == [
        ("pass", 1, 1),
        ("fail", 0, 2),
    ]
    assert result.all_evaluated_mean_score == 0.5


def test_freeform_label_only_folding_keeps_literal_other_label_separate() -> None:
    config = FreeformOutputConfig(type="FREEFORM", name="topic")
    labels = ["Other labels", "a", "b", "c", "d", "e", "f"]
    accumulator = DistributionAccumulator(config, None, None, 0, labels, 20)
    for label in labels + ["exclusive category"]:
        accumulator.add(label, None)
    result = accumulator.result()
    assert result.score_value_counts is result.score_bin_counts is result.score_bin_edges is None
    assert result.all_evaluated_mean_score is None
    assert result.label_counts is not None
    assert len(result.label_counts) == 7
    assert [
        (point.count, point.is_other)
        for point in result.label_counts
        if point.label == "Other labels"
    ] == [(1, False), (2, True)]


@pytest.mark.parametrize("minimum,maximum", [(-5, 5), (3, 3)])
def test_unbounded_continuous_domain_uses_observed_scores(minimum: float, maximum: float) -> None:
    config = ContinuousOutputConfig(
        type="CONTINUOUS", name="score", optimization_direction=OptimizationDirection.NONE
    )
    accumulator = DistributionAccumulator(config, minimum, maximum, 2, [], 0)
    accumulator.add(None, minimum)
    accumulator.add(None, maximum)
    result = accumulator.result()
    assert result.score_bin_counts is not None
    assert len(result.score_bin_counts) == 10
    assert sum(result.score_bin_counts) == 2
    assert result.score_bin_edges is not None
    assert all(
        start < end for start, end in zip(result.score_bin_edges, result.score_bin_edges[1:])
    )


def test_many_freeform_scores_switch_to_histogram() -> None:
    config = FreeformOutputConfig(type="FREEFORM", name="score")
    accumulator = DistributionAccumulator(config, 0, 100, 101, [], 0)
    for score in range(101):
        accumulator.add(None, score)
    result = accumulator.result()
    assert result.score_value_counts is None
    assert result.score_bin_counts is not None
    assert len(result.score_bin_counts) == 10
    assert sum(result.score_bin_counts) == 101
