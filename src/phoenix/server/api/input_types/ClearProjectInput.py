from datetime import datetime
from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID


@strawberry.input
class ClearProjectInput:
    id: GlobalID
    end_time: Optional[datetime] = strawberry.field(
        default=UNSET,
        description="The time up to which to purge data. Time is right-open /non-inclusive.",
    )
