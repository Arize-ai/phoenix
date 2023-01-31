import datetime

import strawberry


@strawberry.input
class TimeRange:
    start: datetime.datetime
    end: datetime.datetime
