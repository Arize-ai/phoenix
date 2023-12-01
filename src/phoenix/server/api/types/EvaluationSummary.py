import math
from functools import cached_property
from typing import List, Optional, Tuple, cast

import pandas as pd
import strawberry
from pandas.api.types import CategoricalDtype
from strawberry import Private

import phoenix.trace.v1 as pb


@strawberry.type
class LabelFraction:
    label: str
    fraction: float


@strawberry.type
class EvaluationSummary:
    count: int
    labels: Tuple[str, ...]
    evaluations: Private[Tuple[pb.Evaluation, ...]]

    def __init__(
        self,
        evaluations: Tuple[pb.Evaluation, ...],
        labels: Tuple[str, ...],
    ) -> None:
        self.evaluations = evaluations
        self.labels = labels
        self.count = len(evaluations)

    @strawberry.field
    def label_fractions(self) -> List[LabelFraction]:
        if not self.labels or not (n := len(self._eval_labels)):
            return []
        counts = self._eval_labels.value_counts(dropna=True)
        return [
            LabelFraction(label=cast(str, label), fraction=count / n)
            for label, count in counts.items()
        ]

    @strawberry.field
    def mean_score(self) -> Optional[float]:
        value = self._eval_scores.mean()
        return None if math.isnan(value) else value

    @strawberry.field
    def score_count(self) -> int:
        return self._eval_scores.count()

    @strawberry.field
    def label_count(self) -> int:
        return self._eval_labels.count()

    @cached_property
    def _eval_scores(self) -> "pd.Series[float]":
        return pd.Series(
            (
                evaluation.result.score.value if evaluation.result.HasField("score") else None
                for evaluation in self.evaluations
            ),
            dtype=float,
        )

    @cached_property
    def _eval_labels(self) -> "pd.Series[CategoricalDtype]":
        return pd.Series(
            (
                evaluation.result.label.value if evaluation.result.HasField("label") else None
                for evaluation in self.evaluations
            ),
            dtype=CategoricalDtype(categories=self.labels),  # type: ignore
        )
