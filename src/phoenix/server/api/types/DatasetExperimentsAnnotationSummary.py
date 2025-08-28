from typing import Optional

import strawberry


@strawberry.type
class DatasetExperimentsAnnotationSummary:
    annotation_name: str
    min_score: Optional[float]
    max_score: Optional[float]
