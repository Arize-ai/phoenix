from datetime import datetime

import strawberry


@strawberry.type
class TimeInterval:
    start: datetime
    end: datetime

    @strawberry.field(
        description="The duration of the time interval in milliseconds.",
    )  # type: ignore
    async def duration_ms(self) -> int:
        return int((self.end - self.start).total_seconds() * 1000)
