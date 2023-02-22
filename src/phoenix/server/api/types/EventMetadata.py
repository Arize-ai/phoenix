from typing import Optional

import strawberry


@strawberry.type
class EventMetadata:
    """A partial record of a model event. E.g. the predictions and actuals"""

    prediction_score: Optional[float]
    prediction_label: Optional[str]
    actual_score: Optional[float]
    actual_label: Optional[str]
