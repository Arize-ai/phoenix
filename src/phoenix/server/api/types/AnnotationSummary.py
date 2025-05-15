from typing import Optional, Union, cast

import pandas as pd
import strawberry
from strawberry import Private

from phoenix.db import models
from phoenix.server.api.types.LabelFraction import LabelFraction

AnnotationType = Union[models.SpanAnnotation, models.TraceAnnotation]


@strawberry.type
class AnnotationSummary:
    name: str
    df: Private[pd.DataFrame]
    simple_avg: Private[bool] = False

    @strawberry.field
    def count(self) -> int:
        return cast(int, self.df.record_count.sum())

    @strawberry.field
    def labels(self) -> list[str]:
        unique_labels = self.df["label"].dropna().unique()
        return [str(label) for label in unique_labels]

    @strawberry.field
    def label_fractions(self) -> list[LabelFraction]:
        if self.simple_avg:
            if not (n := self.df.label_count.sum()):
                return []
            return [
                LabelFraction(
                    label=cast(str, row.label),
                    fraction=row.label_count / n,
                )
                for row in self.df.loc[
                    self.df.label.notna(),
                    ["label", "label_count"],
                ].itertuples()
            ]
        return [
            LabelFraction(
                label=row.label,
                fraction=float(row.avg_label_fraction),
            )
            for row in self.df.itertuples()
            if row.label is not None
        ]

    @strawberry.field
    def mean_score(self) -> Optional[float]:
        if self.simple_avg:
            if not (n := self.df.score_count.sum()):
                return None
            return cast(float, self.df.score_sum.sum() / n)
        avg_scores = self.df["avg_score"].dropna()
        if avg_scores.empty:
            return None
        return float(avg_scores.mean())  # all avg_scores should be the same

    @strawberry.field
    def score_count(self) -> int:
        return cast(int, self.df.score_count.sum())

    @strawberry.field
    def label_count(self) -> int:
        return cast(int, self.df.label_count.sum())
