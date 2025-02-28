from typing import Optional, Union, cast

import pandas as pd
import strawberry
from strawberry import Private

from phoenix.db import models
from phoenix.server.api.types.LabelFraction import LabelFraction

AnnotationType = Union[models.SpanAnnotation, models.TraceAnnotation]


@strawberry.type
class AnnotationSummary:
    df: Private[pd.DataFrame]

    def __init__(self, dataframe: pd.DataFrame) -> None:
        self.df = dataframe

    @strawberry.field
    def count(self) -> int:
        return cast(int, self.df.record_count.sum())

    @strawberry.field
    def labels(self) -> list[str]:
        unique_labels = self.df["label"].dropna().unique()
        return [str(label) for label in unique_labels]

    @strawberry.field
    def label_fractions(self) -> list[LabelFraction]:
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
