import datetime

import strawberry


@strawberry.input
class TimeRange:
    start: datetime.datetime
    end: datetime.datetime

    def is_valid(self) -> bool:
        return self.start < self.end
