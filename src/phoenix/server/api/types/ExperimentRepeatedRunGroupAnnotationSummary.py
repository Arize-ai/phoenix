from typing import Optional

import strawberry


@strawberry.type
class ExperimentRepeatedRunGroupAnnotationSummary:
    annotation_name: str
    mean_score: Optional[float]
