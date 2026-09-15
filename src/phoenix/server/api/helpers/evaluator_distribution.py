"""Bounded distributions over all results from an evaluator."""

import math
from bisect import bisect_right
from dataclasses import dataclass
from typing import Optional, Sequence

from phoenix.db.types.annotation_configs import (
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    FreeformOutputConfig,
    OutputConfigType,
)
from phoenix.server.api.types.EvaluatorDistribution import (
    EvaluatorLabelCount,
    EvaluatorScoreValueCount,
)

SCORE_BIN_COUNT = 10
MAX_DISCRETE_SCORES = 20
MAX_DISTRIBUTION_LABELS = 7


@dataclass(frozen=True)
class DistributionSummary:
    all_evaluated_mean_score: Optional[float]
    score_bin_edges: Optional[list[float]]
    score_bin_counts: Optional[list[int]]
    score_value_counts: Optional[list[EvaluatorScoreValueCount]]
    label_counts: Optional[list[EvaluatorLabelCount]]


class DistributionAccumulator:
    """Accumulate all results with SQL-derived bounds and a bounded label vocabulary.

    Args:
        config: The primary evaluator output configuration.
        minimum: Minimum finite score in the full population.
        maximum: Maximum finite score in the full population.
        distinct_scores: Number of distinct finite scores in the full population.
        labels: Most frequent labels, capped at MAX_DISTRIBUTION_LABELS.
        label_count: Number of distinct labels, before the cap.
    """

    def __init__(
        self,
        config: Optional[OutputConfigType],
        minimum: Optional[float],
        maximum: Optional[float],
        distinct_scores: int,
        labels: Sequence[str],
        label_count: int,
    ) -> None:
        self._has_scores = distinct_scores > 0 or isinstance(config, ContinuousOutputConfig)
        self._has_labels = label_count > 0 or isinstance(config, CategoricalOutputConfig)
        self._is_histogram = (
            isinstance(config, ContinuousOutputConfig) or distinct_scores > MAX_DISCRETE_SCORES
        )
        self._score_count = 0
        self._mean_score = 0.0
        self._discrete: dict[float, EvaluatorScoreValueCount] = {}

        lower = upper = None
        if isinstance(config, (ContinuousOutputConfig, FreeformOutputConfig)):
            lower, upper = config.lower_bound, config.upper_bound
        lower = lower if lower is not None and math.isfinite(lower) else minimum
        upper = upper if upper is not None and math.isfinite(upper) else maximum
        lower = lower if lower is not None else 0.0
        upper = upper if upper is not None else max(lower + 1, 1.0)
        if minimum is not None:
            lower = min(lower, minimum)
        if maximum is not None:
            upper = max(upper, maximum)
        if lower >= upper:
            padding = max(abs(lower) * 0.1, 0.5)
            lower, upper = lower - padding, upper + padding
        self._edges = [
            lower * (1 - index / SCORE_BIN_COUNT) + upper * (index / SCORE_BIN_COUNT)
            for index in range(SCORE_BIN_COUNT + 1)
        ]
        self._histogram = [0] * SCORE_BIN_COUNT

        selected = set(
            labels[: MAX_DISTRIBUTION_LABELS - 1]
            if label_count > MAX_DISTRIBUTION_LABELS
            else labels
        )
        configured_order = (
            [value.label for value in config.values]
            if isinstance(config, CategoricalOutputConfig)
            else []
        )
        ordered = [label for label in configured_order if label in selected]
        ordered.extend(sorted(selected - set(ordered)))
        label_scores = (
            {value.label: value.score for value in config.values}
            if isinstance(config, CategoricalOutputConfig)
            else {}
        )
        self._labels = {
            label: EvaluatorLabelCount(label=label, score=label_scores.get(label))
            for label in ordered
        }
        self._other = EvaluatorLabelCount(label="Other labels", is_other=True)

    def add(self, label: Optional[str], score: Optional[float]) -> None:
        """Count each available value independently; exclude missing and non-finite scores."""
        if score is not None and math.isfinite(score):
            self._score_count += 1
            self._mean_score = (
                self._mean_score * ((self._score_count - 1) / self._score_count)
                + score / self._score_count
            )
            if self._is_histogram:
                index = min(max(bisect_right(self._edges, score) - 1, 0), SCORE_BIN_COUNT - 1)
                self._histogram[index] += 1
            else:
                self._discrete.setdefault(score, EvaluatorScoreValueCount(score=score)).count += 1
        if label is not None:
            self._labels.get(label, self._other).count += 1

    def result(self) -> DistributionSummary:
        """Return histogram arrays or exact score counts, plus independent label counts."""
        label_counts = None
        if self._has_labels:
            label_counts = list(self._labels.values())
            if self._other.count:
                label_counts.append(self._other)
        return DistributionSummary(
            all_evaluated_mean_score=self._mean_score if self._score_count else None,
            score_bin_edges=list(self._edges) if self._has_scores and self._is_histogram else None,
            score_bin_counts=list(self._histogram)
            if self._has_scores and self._is_histogram
            else None,
            score_value_counts=[self._discrete[score] for score in sorted(self._discrete)]
            if self._has_scores and not self._is_histogram
            else None,
            label_counts=label_counts,
        )
