from typing import Optional

import strawberry

from phoenix.server.api.interceptor import ValueMediatorForGql


@strawberry.type
class EventMetadata:
    """A partial record of a model event. E.g. the predictions and actuals"""

    prediction_score: Optional[float] = strawberry.field(default=ValueMediatorForGql())
    prediction_label: Optional[str] = strawberry.field(default=ValueMediatorForGql())
    actual_score: Optional[float] = strawberry.field(default=ValueMediatorForGql())
    actual_label: Optional[str] = strawberry.field(default=ValueMediatorForGql())
