from typing import Optional

import strawberry

from phoenix.server.api.interceptor import NoneIfNan


@strawberry.type
class EventMetadata:
    """A partial record of a model event. E.g. the predictions and actuals"""

    prediction_score: Optional[float] = strawberry.field(default=NoneIfNan())
    prediction_label: Optional[str] = strawberry.field(default=NoneIfNan())
    actual_score: Optional[float] = strawberry.field(default=NoneIfNan())
    actual_label: Optional[str] = strawberry.field(default=NoneIfNan())
