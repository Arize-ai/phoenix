"""Pure computation helpers for comparing two evaluators' results.

Comparison semantics follow the evaluator compare page design
(https://github.com/Arize-ai/phoenix/issues/15512): every statistic is
computed over one shared population — entities in the selected time range
evaluated by both evaluators — so no two numbers can drift to different
denominators.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Callable, Optional, Sequence, Union

import pandas as pd

from phoenix.db.types.annotation_configs import (
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    FreeformOutputConfig,
    OptimizationDirection,
)

OutputConfig = Union[CategoricalOutputConfig, ContinuousOutputConfig, FreeformOutputConfig]

FLAGGED_LABEL = "flagged"
UNFLAGGED_LABEL = "not flagged"
OTHER_LABEL = "other"
MAX_LABELS_PER_SIDE = 7
DEFAULT_FLAG_THRESHOLD = 0.5

# Spearman's rho needs the raw score pairs; collection stops at this many so
# memory stays bounded (the statistic is effectively exact well before that).
SPEARMAN_SAMPLE_SIZE = 100_000


@dataclass(frozen=True)
class SideBinning:
    """How one comparison side turns raw annotation values into matrix labels.

    A categorical evaluator contributes its labels directly. Any other
    evaluator contributes two labels split at its flag threshold. Flag
    semantics pair with the frontend's optimizationUtils.ts: flagged means
    "not on the good side of the pivot" for the config's optimization
    direction — at or above it for MINIMIZE, at or below it for MAXIMIZE —
    and at or above it by default when the direction is undetermined.
    """

    annotation_name: str
    categorical_label_order: Optional[tuple[str, ...]]
    threshold: float = DEFAULT_FLAG_THRESHOLD
    flagged_when_gte: bool = True
    flagged_label_set: Optional[frozenset[str]] = None

    @property
    def is_thresholded(self) -> bool:
        return self.categorical_label_order is None

    def bin(self, label: Optional[str], score: Optional[float]) -> Optional[str]:
        """Return the matrix label for one annotation, or None when unbinnable."""
        if self.categorical_label_order is not None:
            return label
        if score is None:
            return None
        flagged = score >= self.threshold if self.flagged_when_gte else score <= self.threshold
        return FLAGGED_LABEL if flagged else UNFLAGGED_LABEL


def make_side_binning(
    annotation_name: str,
    output_config: Optional[OutputConfig],
    threshold_override: Optional[float],
) -> SideBinning:
    """Build the binning for one comparison side from its evaluator output config.

    The flag threshold is the caller's override when given, else the pivot the
    config pins down (a freeform config's first declared threshold, or the
    midpoint of the config's bounds — value-score bounds for categorical
    configs), else 0.5. A categorical label sitting exactly at the pivot is
    neither good nor bad and never flagged; without a MAXIMIZE/MINIMIZE
    direction or with unscored labels a categorical side has no flag semantics
    at all (None).
    """
    threshold = _pivot(output_config, threshold_override)

    if isinstance(output_config, CategoricalOutputConfig):
        direction = output_config.optimization_direction
        flagged_label_set: Optional[frozenset[str]] = None
        if direction is not OptimizationDirection.NONE and all(
            value.score is not None for value in output_config.values
        ):
            flagged_label_set = frozenset(
                value.label
                for value in output_config.values
                if value.score is not None
                and (
                    value.score > threshold
                    if direction is OptimizationDirection.MINIMIZE
                    else value.score < threshold
                )
            )
        return SideBinning(
            annotation_name=annotation_name,
            categorical_label_order=tuple(value.label for value in output_config.values),
            threshold=threshold,
            flagged_label_set=flagged_label_set,
        )

    continuous_direction = (
        output_config.optimization_direction
        if isinstance(output_config, (ContinuousOutputConfig, FreeformOutputConfig))
        else None
    )
    return SideBinning(
        annotation_name=annotation_name,
        categorical_label_order=None,
        threshold=threshold,
        flagged_when_gte=continuous_direction is not OptimizationDirection.MAXIMIZE,
        flagged_label_set=frozenset({FLAGGED_LABEL}),
    )


def _pivot(output_config: Optional[OutputConfig], threshold_override: Optional[float]) -> float:
    """The score separating flagged from unflagged, per optimizationUtils.ts.

    Override first, then a freeform config's first declared threshold, then
    the midpoint of the config's bounds when both are pinned down, then 0.5.
    """
    if threshold_override is not None:
        return threshold_override
    if isinstance(output_config, FreeformOutputConfig) and output_config.thresholds:
        return output_config.thresholds[0]
    if isinstance(output_config, CategoricalOutputConfig):
        scores = [value.score for value in output_config.values if value.score is not None]
        if len(scores) == len(output_config.values) and scores:
            return (min(scores) + max(scores)) / 2
    if (
        isinstance(output_config, (ContinuousOutputConfig, FreeformOutputConfig))
        and output_config.lower_bound is not None
        and output_config.upper_bound is not None
    ):
        return (output_config.lower_bound + output_config.upper_bound) / 2
    return DEFAULT_FLAG_THRESHOLD


@dataclass(frozen=True)
class SideSummary:
    """Per-evaluator numbers computed over the shared matrix population."""

    annotation_name: str
    labels: tuple[str, ...]
    flagged_labels: Optional[tuple[str, ...]]
    threshold: Optional[float]
    flagged_count: Optional[int]
    flag_rate: Optional[float]
    mean_score: Optional[float]


@dataclass(frozen=True)
class ComparisonResult:
    """Confusion matrix and statistics over the shared population.

    ``matrix`` rows follow ``side_a.labels`` and columns ``side_b.labels``.
    Agreement, kappa, and the disagreement count reduce each side to its
    flagged/not-flagged semantics when both sides have a determinable flagged
    set; when they don't but the two label sets are identical, label equality
    is used instead; otherwise those statistics are None.
    """

    n: int
    matrix: tuple[tuple[int, ...], ...]
    agreement: Optional[float]
    cohens_kappa: Optional[float]
    spearman_rho: Optional[float]
    disagreement_count: Optional[int]
    side_a: SideSummary
    side_b: SideSummary


class ComparisonAccumulator:
    """Single-pass accumulator over (label_a, score_a, label_b, score_b) pairs.

    Feed it every entity evaluated by both evaluators; pairs unbinnable on
    either side (e.g. a missing score on a thresholded side) are excluded
    from the matrix population. Raw score pairs for Spearman's rho are kept
    only when both sides are thresholded (continuous), truncated to the first
    SPEARMAN_SAMPLE_SIZE pairs.
    """

    def __init__(self, binning_a: SideBinning, binning_b: SideBinning) -> None:
        self._binning_a = binning_a
        self._binning_b = binning_b
        self._cell_counts: Counter[tuple[str, str]] = Counter()
        self._score_sum_a = 0.0
        self._score_count_a = 0
        self._score_sum_b = 0.0
        self._score_count_b = 0
        self._collect_score_pairs = binning_a.is_thresholded and binning_b.is_thresholded
        self._score_pairs: list[tuple[float, float]] = []

    def add(
        self,
        label_a: Optional[str],
        score_a: Optional[float],
        label_b: Optional[str],
        score_b: Optional[float],
    ) -> None:
        bin_a = self._binning_a.bin(label_a, score_a)
        bin_b = self._binning_b.bin(label_b, score_b)
        if bin_a is None or bin_b is None:
            return
        self._cell_counts[(bin_a, bin_b)] += 1
        if score_a is not None:
            self._score_sum_a += score_a
            self._score_count_a += 1
        if score_b is not None:
            self._score_sum_b += score_b
            self._score_count_b += 1
        if (
            self._collect_score_pairs
            and score_a is not None
            and score_b is not None
            and len(self._score_pairs) < SPEARMAN_SAMPLE_SIZE
        ):
            self._score_pairs.append((score_a, score_b))

    def result(self) -> ComparisonResult:
        n = sum(self._cell_counts.values())
        marginals_a: Counter[str] = Counter()
        marginals_b: Counter[str] = Counter()
        for (raw_a, raw_b), count in self._cell_counts.items():
            marginals_a[raw_a] += count
            marginals_b[raw_b] += count
        labels_a = _fold_labels(marginals_a, self._binning_a)
        labels_b = _fold_labels(marginals_b, self._binning_b)
        kept_a = set(labels_a)
        kept_b = set(labels_b)
        index_a = {label: index for index, label in enumerate(labels_a)}
        index_b = {label: index for index, label in enumerate(labels_b)}
        matrix = [[0 for _ in labels_b] for _ in labels_a]
        for (raw_a, raw_b), count in self._cell_counts.items():
            row = index_a[raw_a if raw_a in kept_a else OTHER_LABEL]
            column = index_b[raw_b if raw_b in kept_b else OTHER_LABEL]
            matrix[row][column] += count

        # Agreement statistics reduce over the raw (unfolded) labels so a
        # flagged label folded into "other" still counts as flagged.
        agreement, kappa, disagreements = _agreement_statistics(
            self._cell_counts,
            self._binning_a.flagged_label_set,
            self._binning_b.flagged_label_set,
        )

        spearman = spearman_rho(self._score_pairs) if self._score_pairs else None

        return ComparisonResult(
            n=n,
            matrix=tuple(tuple(row) for row in matrix),
            agreement=agreement,
            cohens_kappa=kappa,
            spearman_rho=spearman,
            disagreement_count=disagreements,
            side_a=self._side_summary(
                self._binning_a, labels_a, marginals_a, n, self._score_sum_a, self._score_count_a
            ),
            side_b=self._side_summary(
                self._binning_b, labels_b, marginals_b, n, self._score_sum_b, self._score_count_b
            ),
        )

    @staticmethod
    def _side_summary(
        binning: SideBinning,
        labels: tuple[str, ...],
        marginal: Counter[str],
        n: int,
        score_sum: float,
        score_count: int,
    ) -> SideSummary:
        flagged_count: Optional[int] = None
        flag_rate: Optional[float] = None
        raw_flagged = binning.flagged_label_set
        if raw_flagged is not None:
            flagged_count = sum(count for label, count in marginal.items() if label in raw_flagged)
            flag_rate = flagged_count / n if n else None
        displayed_flagged = (
            tuple(label for label in labels if label in raw_flagged)
            if raw_flagged is not None
            else None
        )
        return SideSummary(
            annotation_name=binning.annotation_name,
            labels=labels,
            flagged_labels=displayed_flagged,
            threshold=binning.threshold if binning.is_thresholded else None,
            flagged_count=flagged_count,
            flag_rate=flag_rate,
            mean_score=score_sum / score_count if score_count else None,
        )


def _fold_labels(counts: Counter[str], binning: SideBinning) -> tuple[str, ...]:
    """Order the observed labels and fold the tail into "other" past the cap.

    A thresholded side always shows both of its labels, even at zero count.
    A categorical side shows the labels present in the data, ordered by the
    config's declared order first, then alphabetically for unexpected labels;
    past MAX_LABELS_PER_SIDE the least frequent fold into "other".
    """
    if binning.is_thresholded:
        return (FLAGGED_LABEL, UNFLAGGED_LABEL)
    observed = set(counts)
    ordered = [label for label in (binning.categorical_label_order or ()) if label in observed]
    ordered.extend(sorted(observed - set(ordered)))
    if len(ordered) <= MAX_LABELS_PER_SIDE:
        return tuple(ordered)
    most_frequent = set(
        sorted(ordered, key=lambda label: -counts[label])[: MAX_LABELS_PER_SIDE - 1]
    )
    return tuple(label for label in ordered if label in most_frequent) + (OTHER_LABEL,)


def _agreement_statistics(
    cell_counts: Counter[tuple[str, str]],
    flagged_a: Optional[frozenset[str]],
    flagged_b: Optional[frozenset[str]],
) -> tuple[Optional[float], Optional[float], Optional[int]]:
    """Compute (agreement, kappa, disagreement count) over the raw cell counts.

    Preferred reduction is binary flagged/not-flagged; the fallback when
    either flagged set is undeterminable is label equality, available only
    when both sides share an identical label set.
    """
    n = sum(cell_counts.values())
    if n == 0:
        return None, None, None
    index_a: Callable[[str], int]
    index_b: Callable[[str], int]
    if flagged_a is not None and flagged_b is not None:
        size = 2
        index_a = lambda label: 0 if label in flagged_a else 1  # noqa: E731
        index_b = lambda label: 0 if label in flagged_b else 1  # noqa: E731
    else:
        labels = {key[0] for key in cell_counts}
        if labels != {key[1] for key in cell_counts}:
            return None, None, None
        position = {label: index for index, label in enumerate(sorted(labels))}
        size = len(position)
        index_a = index_b = position.__getitem__
    table = [[0 for _ in range(size)] for _ in range(size)]
    for (raw_a, raw_b), count in cell_counts.items():
        table[index_a(raw_a)][index_b(raw_b)] += count
    agreements = sum(table[position][position] for position in range(size))
    return agreements / n, cohens_kappa(table), n - agreements


def cohens_kappa(matrix: Sequence[Sequence[int]]) -> Optional[float]:
    """Cohen's kappa for a square contingency table with shared label order.

    Returns None when the table is empty or expected agreement is 1 (kappa
    is undefined there).
    """
    n = sum(sum(row) for row in matrix)
    if n == 0:
        return None
    size = len(matrix)
    observed = sum(matrix[position][position] for position in range(size)) / n
    row_totals = [sum(row) for row in matrix]
    column_totals = [sum(matrix[row][column] for row in range(size)) for column in range(size)]
    expected = sum(row_totals[position] * column_totals[position] for position in range(size)) / (
        n * n
    )
    if expected == 1:
        return None
    return (observed - expected) / (1 - expected)


def spearman_rho(pairs: Sequence[tuple[float, float]]) -> Optional[float]:
    """Spearman rank correlation with average ranks for ties.

    Returns None with fewer than two pairs or when either side has zero
    rank variance.
    """
    if len(pairs) < 2:
        return None
    series_a = pd.Series([pair[0] for pair in pairs], dtype=float)
    series_b = pd.Series([pair[1] for pair in pairs], dtype=float)
    rho = series_a.corr(series_b, method="spearman")
    return None if pd.isna(rho) else float(rho)
