from typing import Optional

import strawberry


@strawberry.type
class ExperimentAnnotationSummary:
    annotation_name: str
    mean_score: Optional[float]
    min_score: Optional[float]
    max_score: Optional[float]
