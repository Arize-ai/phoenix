import math
from functools import cached_property
from typing import List, Optional, Sequence, Union, cast

import pandas as pd
import strawberry
from pandas.api.types import CategoricalDtype
from strawberry import Private

from phoenix.db import models

AnnotationType = Union[models.SpanAnnotation, models.TraceAnnotation]


@strawberry.type
class LabelFraction:
    label: str
    fraction: float


@strawberry.type
class EvaluationSummary:
    count: int
    labels: Sequence[str]
    annotations: Private[Sequence[AnnotationType]]

    def __init__(
        self,
        annotations: Sequence[AnnotationType],
        labels: Sequence[str],
    ) -> None:
        self.annotations = annotations
        self.labels = labels
        self.count = len(annotations)

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
            (evaluation.score for evaluation in self.annotations),
            dtype=float,
        )

    @cached_property
    def _eval_labels(self) -> "pd.Series[CategoricalDtype]":
        return pd.Series(
            (evaluation.label for evaluation in self.annotations),
            dtype=CategoricalDtype(categories=self.labels),  # type: ignore
        )
