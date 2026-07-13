from typing import Optional

import strawberry

from phoenix.server.api.types.LabelFraction import LabelFraction


@strawberry.type
class ExperimentAnnotationSummary:
    annotation_name: str
    min_score: Optional[float]
    max_score: Optional[float]
    mean_score: Optional[float]
    count: int
    error_count: int
    score_count: int
    label_count: int
    label_fractions: list[LabelFraction]
