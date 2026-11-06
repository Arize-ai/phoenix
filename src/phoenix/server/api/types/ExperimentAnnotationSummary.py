from typing import Optional

import strawberry
from strawberry import Private
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.types.LabelFraction import LabelFraction


@strawberry.type
class ExperimentAnnotationSummary:
    experiment_id: Private[int]
    annotation_name: str
    min_score: Optional[float]
    max_score: Optional[float]
    mean_score: Optional[float]
    count: int
    error_count: int
    score_count: int
    label_count: int

    @strawberry.field
    async def label_fractions(self, info: Info[Context, None]) -> list[LabelFraction]:
        loader = info.context.data_loaders.experiment_annotation_label_fractions
        return [
            LabelFraction(label=label, fraction=fraction)
            for label, fraction in await loader.load((self.experiment_id, self.annotation_name))
        ]
