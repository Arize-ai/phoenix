from typing import List, Optional, Union, cast

import pandas as pd
import strawberry
from strawberry import Private

from phoenix.db import models

AnnotationType = Union[models.SpanAnnotation, models.TraceAnnotation]


@strawberry.type
class LabelFraction:
    label: str
    fraction: float


@strawberry.type
class EvaluationSummary:
    df: Private[pd.DataFrame]

    def __init__(self, dataframe: pd.DataFrame) -> None:
        self.df = dataframe

    @strawberry.field
    def count(self) -> int:
        return cast(int, self.df.record_count.sum())

    @strawberry.field
    def labels(self) -> List[str]:
        return self.df.label.dropna().tolist()

    @strawberry.field
    def label_fractions(self) -> List[LabelFraction]:
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

    @strawberry.field
    def mean_score(self) -> Optional[float]:
        if not (n := self.df.score_count.sum()):
            return None
        return cast(float, self.df.score_sum.sum() / n)

    @strawberry.field
    def score_count(self) -> int:
        return cast(int, self.df.score_count.sum())

    @strawberry.field
    def label_count(self) -> int:
        return cast(int, self.df.label_count.sum())
