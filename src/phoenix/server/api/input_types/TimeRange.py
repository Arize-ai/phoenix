from datetime import datetime, timezone
from typing import Optional

import strawberry


@strawberry.input
class TimeRange:
    start: Optional[datetime] = strawberry.field(
        default=None,
        description="The start of the time range",
    )
    end: Optional[datetime] = strawberry.field(
        default=None,
        description="The end of the time range. Right exclusive.",
    )

    def __post_init__(self) -> None:
        if self.start:
            self.start = self.start.astimezone(timezone.utc)
        if self.end:
            self.end = self.end.astimezone(timezone.utc)

    def is_valid(self) -> bool:
        return not self.start or not self.end or self.start < self.end
