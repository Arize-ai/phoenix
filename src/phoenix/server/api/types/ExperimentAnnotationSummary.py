from typing import Optional

import strawberry


@strawberry.type
class ExperimentAnnotationSummary:
    annotation_name: str
    mean_score: Optional[float]
    experiment_id: strawberry.Private[int]
