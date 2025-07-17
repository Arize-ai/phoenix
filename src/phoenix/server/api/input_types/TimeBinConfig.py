from enum import Enum

import strawberry


@strawberry.enum
class TimeBinScale(Enum):
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"


@strawberry.input
class TimeBinConfig:
    scale: TimeBinScale = strawberry.field(
        default=TimeBinScale.HOUR, description="The scale of time bins for aggregation."
    )
    utc_offset_minutes: int = strawberry.field(
        default=0, description="Offset in minutes from UTC for local time binning."
    )
