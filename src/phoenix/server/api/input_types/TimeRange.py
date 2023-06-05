from datetime import datetime, timezone

import strawberry


@strawberry.input
class TimeRange:
    start: datetime = strawberry.field(
        description="The start of the time range",
    )
    end: datetime = strawberry.field(
        description="The end of the time range. Right exclusive.",
    )

    def __post_init__(self) -> None:
        self.start = self.start.astimezone(timezone.utc)
        self.end = self.end.astimezone(timezone.utc)

    def is_valid(self) -> bool:
        return self.start < self.end
