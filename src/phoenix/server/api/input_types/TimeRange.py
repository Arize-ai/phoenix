from datetime import datetime

import strawberry


@strawberry.input
class TimeRange:
    start: datetime = strawberry.field(description="The start of the time range")
    end: datetime = strawberry.field(description="The end of the time range. Right exclusive.")

    def is_valid(self) -> bool:
        return self.start < self.end
