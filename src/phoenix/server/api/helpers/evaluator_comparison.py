"""Pure computation helpers for comparing two evaluators' results.

Comparison semantics follow the evaluator compare page design
(https://github.com/Arize-ai/phoenix/issues/15512): every statistic is
computed over one shared population — entities in the selected time range
evaluated by both evaluators — so no two numbers can drift to different
denominators.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Literal, Optional, Sequence, Union

import pandas as pd

from phoenix.datetime_utils import get_timestamp_range
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

# Score distributions use this many fixed bins over the side's score domain;
# out-of-range scores clamp into the edge bins.
SCORE_BIN_COUNT = 10

DEFAULT_SCORE_DOMAIN = (0.0, 1.0)


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
    score_domain: tuple[float, float] = DEFAULT_SCORE_DOMAIN

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

    def score_bin_index(self, score: float) -> int:
        low, high = self.score_domain
        span = high - low
        position = (score - low) / span if span else 0.0
        return min(max(int(position * SCORE_BIN_COUNT), 0), SCORE_BIN_COUNT - 1)

    def score_bin_edges(self) -> tuple[float, ...]:
        low, high = self.score_domain
        step = (high - low) / SCORE_BIN_COUNT
        return tuple(low + step * index for index in range(SCORE_BIN_COUNT + 1))


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
    score_domain = DEFAULT_SCORE_DOMAIN
    if (
        isinstance(output_config, (ContinuousOutputConfig, FreeformOutputConfig))
        and output_config.lower_bound is not None
        and output_config.upper_bound is not None
    ):
        score_domain = (output_config.lower_bound, output_config.upper_bound)
    return SideBinning(
        annotation_name=annotation_name,
        categorical_label_order=None,
        threshold=threshold,
        flagged_when_gte=continuous_direction is not OptimizationDirection.MAXIMIZE,
        flagged_label_set=frozenset({FLAGGED_LABEL}),
        score_domain=score_domain,
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
    score_bin_counts: Optional[tuple[int, ...]]
    score_bin_edges: Optional[tuple[float, ...]]


@dataclass(frozen=True)
class ComparisonTimeSeriesPoint:
    """One time bin's numbers over the shared population in that bin."""

    timestamp: datetime
    evaluated_by_both: int = 0
    flag_rate_a: Optional[float] = None
    flag_rate_b: Optional[float] = None
    mean_score_a: Optional[float] = None
    mean_score_b: Optional[float] = None
    agreement: Optional[float] = None


def fill_comparison_time_series(
    points: Sequence[ComparisonTimeSeriesPoint],
    start_time: datetime,
    end_time: Optional[datetime],
    stride: Literal["minute", "hour", "day", "week", "month", "year"],
    utc_offset_minutes: int,
) -> tuple[ComparisonTimeSeriesPoint, ...]:
    """Insert empty bins so the series spans the requested range, sorted.

    Mirrors the annotation metrics fields' back-fill so all Project metrics
    time axes stay aligned.
    """
    by_timestamp = {point.timestamp: point for point in points}
    min_time = min([*by_timestamp, start_time])
    max_time = max([*by_timestamp, end_time if end_time else datetime.now(timezone.utc)])
    for timestamp in get_timestamp_range(
        start_time=min_time,
        end_time=max_time,
        stride=stride,
        utc_offset_minutes=utc_offset_minutes,
    ):
        if timestamp not in by_timestamp:
            by_timestamp[timestamp] = ComparisonTimeSeriesPoint(timestamp=timestamp)
    return tuple(sorted(by_timestamp.values(), key=lambda point: point.timestamp))


@dataclass(frozen=True)
class ComparisonResult:
    """Confusion matrix and statistics over the shared population.

    ``matrix`` rows follow ``side_a.labels`` and columns ``side_b.labels``.
    Agreement, kappa, and the disagreement count reduce each side to its
    flagged/not-flagged semantics when both sides have a determinable flagged
    set; when they don't but the two label sets are identical, label equality
    is used instead; otherwise those statistics are None. ``time_series``
    holds only the bins that had data, sorted by timestamp; callers fill in
    empty bins with `fill_comparison_time_series`.
    """

    n: int
    matrix: tuple[tuple[int, ...], ...]
    agreement: Optional[float]
    cohens_kappa: Optional[float]
    spearman_rho: Optional[float]
    disagreement_count: Optional[int]
    side_a: SideSummary
    side_b: SideSummary
    time_series: tuple[ComparisonTimeSeriesPoint, ...]


@dataclass
class _TimeBin:
    """Raw per-bin accumulation; every per-bin statistic derives from it."""

    cells: Counter[tuple[str, str]] = field(default_factory=Counter)
    score_sum_a: float = 0.0
    score_count_a: int = 0
    score_sum_b: float = 0.0
    score_count_b: int = 0


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
        self._score_bins_a = [0] * SCORE_BIN_COUNT if binning_a.is_thresholded else None
        self._score_bins_b = [0] * SCORE_BIN_COUNT if binning_b.is_thresholded else None
        self._time_bins: dict[datetime, _TimeBin] = {}

    def add(
        self,
        label_a: Optional[str],
        score_a: Optional[float],
        label_b: Optional[str],
        score_b: Optional[float],
        bucket: Optional[datetime] = None,
    ) -> None:
        bin_a = self._binning_a.bin(label_a, score_a)
        bin_b = self._binning_b.bin(label_b, score_b)
        if bin_a is None or bin_b is None:
            return
        self._cell_counts[(bin_a, bin_b)] += 1
        if score_a is not None:
            self._score_sum_a += score_a
            self._score_count_a += 1
            if self._score_bins_a is not None:
                self._score_bins_a[self._binning_a.score_bin_index(score_a)] += 1
        if score_b is not None:
            self._score_sum_b += score_b
            self._score_count_b += 1
            if self._score_bins_b is not None:
                self._score_bins_b[self._binning_b.score_bin_index(score_b)] += 1
        if (
            self._collect_score_pairs
            and score_a is not None
            and score_b is not None
            and len(self._score_pairs) < SPEARMAN_SAMPLE_SIZE
        ):
            self._score_pairs.append((score_a, score_b))
        if bucket is not None:
            time_bin = self._time_bins.get(bucket)
            if time_bin is None:
                time_bin = self._time_bins[bucket] = _TimeBin()
            time_bin.cells[(bin_a, bin_b)] += 1
            if score_a is not None:
                time_bin.score_sum_a += score_a
                time_bin.score_count_a += 1
            if score_b is not None:
                time_bin.score_sum_b += score_b
                time_bin.score_count_b += 1

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
        # flagged label folded into "other" still counts as flagged; the same
        # reduction serves the overall statistics and every time bin.
        reduction = _choose_reduction(
            self._cell_counts,
            self._binning_a.flagged_label_set,
            self._binning_b.flagged_label_set,
        )
        if n and reduction is not None:
            agreements = _count_agreements(self._cell_counts, reduction)
            agreement: Optional[float] = agreements / n
            kappa = cohens_kappa(_reduction_table(self._cell_counts, reduction))
            disagreements: Optional[int] = n - agreements
        else:
            agreement = kappa = None
            disagreements = None

        spearman = spearman_rho(self._score_pairs) if self._score_pairs else None

        return ComparisonResult(
            n=n,
            matrix=tuple(tuple(row) for row in matrix),
            agreement=agreement,
            cohens_kappa=kappa,
            spearman_rho=spearman,
            disagreement_count=disagreements,
            side_a=self._side_summary(
                self._binning_a,
                labels_a,
                marginals_a,
                n,
                self._score_sum_a,
                self._score_count_a,
                self._score_bins_a,
            ),
            side_b=self._side_summary(
                self._binning_b,
                labels_b,
                marginals_b,
                n,
                self._score_sum_b,
                self._score_count_b,
                self._score_bins_b,
            ),
            time_series=self._time_series_points(reduction),
        )

    def _time_series_points(
        self, reduction: Optional[_Reduction]
    ) -> tuple[ComparisonTimeSeriesPoint, ...]:
        flagged_a = self._binning_a.flagged_label_set
        flagged_b = self._binning_b.flagged_label_set
        points = []
        for timestamp in sorted(self._time_bins):
            time_bin = self._time_bins[timestamp]
            bin_n = sum(time_bin.cells.values())
            flag_rate_a = (
                sum(count for (raw_a, _), count in time_bin.cells.items() if raw_a in flagged_a)
                / bin_n
                if flagged_a is not None
                else None
            )
            flag_rate_b = (
                sum(count for (_, raw_b), count in time_bin.cells.items() if raw_b in flagged_b)
                / bin_n
                if flagged_b is not None
                else None
            )
            points.append(
                ComparisonTimeSeriesPoint(
                    timestamp=timestamp,
                    evaluated_by_both=bin_n,
                    flag_rate_a=flag_rate_a,
                    flag_rate_b=flag_rate_b,
                    mean_score_a=(
                        time_bin.score_sum_a / time_bin.score_count_a
                        if time_bin.score_count_a
                        else None
                    ),
                    mean_score_b=(
                        time_bin.score_sum_b / time_bin.score_count_b
                        if time_bin.score_count_b
                        else None
                    ),
                    agreement=(
                        _count_agreements(time_bin.cells, reduction) / bin_n
                        if reduction is not None
                        else None
                    ),
                )
            )
        return tuple(points)

    @staticmethod
    def _side_summary(
        binning: SideBinning,
        labels: tuple[str, ...],
        marginal: Counter[str],
        n: int,
        score_sum: float,
        score_count: int,
        score_bins: Optional[list[int]],
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
            score_bin_counts=tuple(score_bins) if score_bins is not None else None,
            score_bin_edges=binning.score_bin_edges() if score_bins is not None else None,
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


@dataclass(frozen=True)
class _Reduction:
    """Maps each side's raw labels to shared agreement-table indices."""

    size: int
    index_a: Callable[[str], int]
    index_b: Callable[[str], int]


def _choose_reduction(
    cell_counts: Counter[tuple[str, str]],
    flagged_a: Optional[frozenset[str]],
    flagged_b: Optional[frozenset[str]],
) -> Optional[_Reduction]:
    """Pick the agreement reduction: binary flagged/not-flagged when both sides
    have determinable flag semantics, else label equality when the two label
    sets are identical, else None."""
    if flagged_a is not None and flagged_b is not None:
        return _Reduction(
            size=2,
            index_a=lambda label: 0 if label in flagged_a else 1,
            index_b=lambda label: 0 if label in flagged_b else 1,
        )
    labels = {key[0] for key in cell_counts}
    if not labels or labels != {key[1] for key in cell_counts}:
        return None
    position = {label: index for index, label in enumerate(sorted(labels))}
    return _Reduction(
        size=len(position), index_a=position.__getitem__, index_b=position.__getitem__
    )


def _count_agreements(cell_counts: Counter[tuple[str, str]], reduction: _Reduction) -> int:
    return sum(
        count
        for (raw_a, raw_b), count in cell_counts.items()
        if reduction.index_a(raw_a) == reduction.index_b(raw_b)
    )


def _reduction_table(
    cell_counts: Counter[tuple[str, str]], reduction: _Reduction
) -> list[list[int]]:
    table = [[0 for _ in range(reduction.size)] for _ in range(reduction.size)]
    for (raw_a, raw_b), count in cell_counts.items():
        table[reduction.index_a(raw_a)][reduction.index_b(raw_b)] += count
    return table


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
