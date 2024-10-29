from typing import Optional

import strawberry

from phoenix.server.api.interceptor import GqlValueMediator


@strawberry.type
class EventMetadata:
    """A partial record of a model event. E.g. the predictions and actuals"""

    prediction_id: Optional[str] = strawberry.field(default=GqlValueMediator())
    prediction_score: Optional[float] = strawberry.field(default=GqlValueMediator())
    prediction_label: Optional[str] = strawberry.field(default=GqlValueMediator())
    actual_score: Optional[float] = strawberry.field(default=GqlValueMediator())
    actual_label: Optional[str] = strawberry.field(default=GqlValueMediator())
