from typing import Optional

import strawberry


@strawberry.type
class ExperimentAnnotationSummary:
    annotation_name: str
    min_score: Optional[float]
    max_score: Optional[float]
    mean_score: Optional[float]
    count: int
    error_count: int
