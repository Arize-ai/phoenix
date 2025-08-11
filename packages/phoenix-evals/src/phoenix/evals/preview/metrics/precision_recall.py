"""
Precision/Recall/F-score (F-beta) evaluator for single-label classification.

- Supports binary and multi-class problems
- Labels can be strings or integers (must be hashable)
- No external dependencies

Key behaviors:
- Binary mode: If `positive_label` is provided, or labels are exactly {0, 1} with no
  `positive_label` provided (defaults to positive=1), computes precision/recall/F exclusively
  for the positive class (one-vs-rest). No averaging suffix is used in metric names.
- Multi-class mode: Computes per-class metrics one-vs-rest and aggregates using the selected
  averaging strategy: "macro" (default), "micro", or "weighted". When average is not the default
  "macro", a suffix (e.g., `_micro`) is appended to metric names.

Naming rules:
- Defaults (beta=1.0, average="macro"): names are `precision`, `recall`, and `f1`.
- Non-default average: e.g., `precision_micro`, `recall_weighted`, `f0_5_micro`.

Zero-division handling:
- When a denominator is zero (e.g., a class has no predicted or true instances), the metric is
  set to `zero_division` (default 0.0), consistent with common library behavior.

Examples:
1) Multi-class (macro):
>>> from phoenix.evals.preview.metrics.precision_recall import PrecisionRecallFScore
>>> evaluator = PrecisionRecallFScore(beta=1.0, average="macro")
>>> eval_input = {"expected": ["cat", "dog", "cat", "bird"],
...               "output": ["cat", "cat", "cat", "bird"]}
>>> scores = evaluator(eval_input)
>>> [s.name for s in scores]
['precision', 'recall', 'f1']

2) Binary with explicit positive label:
>>> evaluator = PrecisionRecallFScore(beta=0.5, positive_label="spam")
>>> eval_input = {"expected": ["spam", "ham", "spam"],
...               "output": ["spam", "spam", "ham"]}
>>> scores = evaluator(eval_input)
>>> [s.name for s in scores]
['precision', 'recall', 'f0_5']
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import (
    Any,
    Dict,
    Hashable,
    List,
    Literal,
    Mapping,
    Optional,
    Sequence,
    Tuple,
)

from ..evaluators import Evaluator, Score

AverageType = Literal["macro", "micro", "weighted"]


def _format_beta_for_name(beta: float) -> str:
    if beta <= 0:
        # Validation will raise elsewhere; keep a safe fallback
        return "f"
    if float(beta).is_integer():
        return f"f{int(beta)}"
    text = ("%g" % beta).replace(".", "_")
    return f"f{text}"


@dataclass(frozen=True)
class _ClassCounts:
    true_positive: int = 0
    false_positive: int = 0
    false_negative: int = 0

    @property
    def support(self) -> int:
        return self.true_positive + self.false_negative


class PrecisionRecallFScore(Evaluator):
    """
    Heuristic evaluator that computes precision, recall, and F-score.

    - Required fields: `expected`, `output` (sequences of labels)
    - Supports labels as strings or integers
    - Supports binary and multi-class via averaging strategies

    Parameters
    - beta: weight of recall relative to precision. Must be > 0. Defaults to 1.0 (F1).
    - average: aggregation strategy across classes. One of {'macro','micro','weighted'}.
               Defaults to 'macro'. Suffixes are only appended to metric names when a non-default
               average is used.
    - positive_label: when set, compute binary precision/recall/F exclusively for this label
                      (one-vs-rest). If None and labels are numeric with unique set {0,1}, the
                      positive label defaults to 1. Otherwise, multi-class averaging is used.
    - zero_division: value to use when a metric is undefined (e.g., 0/0). Defaults to 0.0.

    Inputs
    - expected, output: sequences (e.g., list, tuple, NumPy array) of hashable labels. Passing a
      single string (e.g., 'cat') is not supported; pass a sequence instead (e.g., ['cat']).
    """

    def __init__(
        self,
        *,
        beta: float = 1.0,
        average: AverageType = "macro",
        zero_division: float = 0.0,
        positive_label: Optional[Hashable] = None,
    ) -> None:
        super().__init__(
            name="precision_recall_fscore",
            source="heuristic",
            required_fields={"expected", "output"},
            direction="maximize",
        )
        if beta <= 0:
            raise ValueError("beta must be > 0")
        if average not in ("macro", "micro", "weighted"):
            raise ValueError("average must be one of {'macro','micro','weighted'}")
        self.beta = float(beta)
        self.average = average
        self.zero_division = float(zero_division)
        self.positive_label = positive_label

    def _evaluate(self, eval_input: Mapping[str, Any]) -> List[Score]:
        expected_raw = eval_input["expected"]
        output_raw = eval_input["output"]

        # Disallow accidental single-string inputs (strings are Sequences)
        if isinstance(expected_raw, (str, bytes)) or isinstance(output_raw, (str, bytes)):
            raise ValueError("expected and output must be sequences of labels, not single strings")

        if not isinstance(expected_raw, Sequence) or not isinstance(output_raw, Sequence):
            raise ValueError("expected and output must be sequences of labels")

        expected = list(expected_raw)
        output = list(output_raw)

        # Ensure labels are hashable so they can be used as dict/set keys
        self._assert_hashable_labels(expected, "expected")
        self._assert_hashable_labels(output, "output")

        if len(expected) != len(output):
            raise ValueError(
                f"expected and output must have the same length. Got {len(expected)} and "
                f"{len(output)}"
            )
        if len(expected) == 0:
            raise ValueError("expected and output must be non-empty")

        labels = self._collect_labels(expected, output)
        counts_by_label = self._compute_counts(expected, output, labels)

        # Determine if we are in binary (positive_label) mode
        pos_label = self._resolve_positive_label(self.positive_label, labels)

        if pos_label is not None:
            class_counts = counts_by_label.get(pos_label)
            if class_counts is None:
                raise ValueError(
                    f"positive_label {pos_label!r} not present in labels {list(labels)!r}"
                )
            precision = self._safe_div(
                class_counts.true_positive, class_counts.true_positive + class_counts.false_positive
            )
            recall = self._safe_div(
                class_counts.true_positive, class_counts.true_positive + class_counts.false_negative
            )
            suffix = ""
        else:
            precision, recall = self._aggregate_precision_recall(counts_by_label)
            suffix = "" if self.average == "macro" else f"_{self.average}"

        f_score = self._compute_f_score(precision, recall, self.beta)

        beta_name = _format_beta_for_name(self.beta)

        return [
            Score(
                name=f"precision{suffix}",
                score=precision,
                source=self.source,
                direction=self.direction,
                metadata={
                    "beta": self.beta,
                    "average": self.average,
                    "labels": list(labels),
                    "positive_label": pos_label,
                },
            ),
            Score(
                name=f"recall{suffix}",
                score=recall,
                source=self.source,
                direction=self.direction,
                metadata={
                    "beta": self.beta,
                    "average": self.average,
                    "labels": list(labels),
                    "positive_label": pos_label,
                },
            ),
            Score(
                name=f"{beta_name}{suffix}",
                score=f_score,
                source=self.source,
                direction=self.direction,
                metadata={
                    "beta": self.beta,
                    "average": self.average,
                    "labels": list(labels),
                    "positive_label": pos_label,
                },
            ),
        ]

    def _collect_labels(
        self, expected: Sequence[Hashable], output: Sequence[Hashable]
    ) -> List[Hashable]:
        # Preserve a stable, interpretable order: first seen in expected, then unseen from output
        seen = set()
        ordered: List[Hashable] = []
        for y in expected:
            if y not in seen:
                seen.add(y)
                ordered.append(y)
        for y in output:
            if y not in seen:
                seen.add(y)
                ordered.append(y)
        return ordered

    def _compute_counts(
        self, expected: Sequence[Hashable], output: Sequence[Hashable], labels: Sequence[Hashable]
    ) -> Dict[Hashable, _ClassCounts]:
        counts: Dict[Hashable, _ClassCounts] = {label: _ClassCounts() for label in labels}
        for yt, yp in zip(expected, output):
            if yt == yp:
                tp = counts[yt].true_positive + 1
                counts[yt] = _ClassCounts(
                    true_positive=tp,
                    false_positive=counts[yt].false_positive,
                    false_negative=counts[yt].false_negative,
                )
            else:
                # Predicted class receives a false positive
                if yp in counts:
                    c = counts[yp]
                    counts[yp] = _ClassCounts(
                        true_positive=c.true_positive,
                        false_positive=c.false_positive + 1,
                        false_negative=c.false_negative,
                    )
                # True class receives a false negative
                if yt in counts:
                    c = counts[yt]
                    counts[yt] = _ClassCounts(
                        true_positive=c.true_positive,
                        false_positive=c.false_positive,
                        false_negative=c.false_negative + 1,
                    )
        return counts

    def _safe_div(self, numerator: float, denominator: float) -> float:
        if denominator == 0.0:
            return float(self.zero_division)
        return numerator / denominator

    def _aggregate_precision_recall(
        self, counts_by_label: Mapping[Hashable, _ClassCounts]
    ) -> Tuple[float, float]:
        if self.average == "micro":
            tp = sum(c.true_positive for c in counts_by_label.values())
            fp = sum(c.false_positive for c in counts_by_label.values())
            fn = sum(c.false_negative for c in counts_by_label.values())
            precision = self._safe_div(tp, tp + fp)
            recall = self._safe_div(tp, tp + fn)
            return precision, recall

        # per-class metrics
        per_class_precision: List[float] = []
        per_class_recall: List[float] = []
        supports: List[int] = []
        for c in counts_by_label.values():
            p = self._safe_div(c.true_positive, c.true_positive + c.false_positive)
            r = self._safe_div(c.true_positive, c.true_positive + c.false_negative)
            per_class_precision.append(p)
            per_class_recall.append(r)
            supports.append(c.support)

        if self.average == "macro":
            precision = sum(per_class_precision) / len(per_class_precision)
            recall = sum(per_class_recall) / len(per_class_recall)
            return precision, recall

        # weighted
        total = sum(supports)
        if total == 0:
            return float(self.zero_division), float(self.zero_division)
        precision = sum(p * s for p, s in zip(per_class_precision, supports)) / total
        recall = sum(r * s for r, s in zip(per_class_recall, supports)) / total
        return precision, recall

    def _compute_f_score(self, precision: float, recall: float, beta: float) -> float:
        if precision == 0.0 and recall == 0.0:
            return 0.0
        beta_sq = beta * beta
        numerator = (1 + beta_sq) * precision * recall
        denominator = (beta_sq * precision) + recall
        return self._safe_div(numerator, denominator)

    def _resolve_positive_label(
        self, configured_positive: Optional[Hashable], labels: Sequence[Hashable]
    ) -> Optional[Hashable]:
        """
        Decide whether to run in binary mode and which label is positive.

        - If a positive label is provided, use it.
        - Else, if labels are a binary numeric set {0, 1}, use 1 as positive.
        - Otherwise, return None to indicate multi-class averaging mode.
        """
        if configured_positive is not None:
            return configured_positive

        unique = set(labels)
        if unique.issubset({0, 1}) and len(unique) == 2:
            return 1
        return None

    def _assert_hashable_labels(self, labels: Sequence[Any], name: str) -> None:
        for idx, value in enumerate(labels):
            try:
                hash(value)
            except TypeError as e:
                raise ValueError(
                    f"All labels in {name} must be hashable. "
                    f"Found unhashable value at index {idx}: {value!r}"
                ) from e
