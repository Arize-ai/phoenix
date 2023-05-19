from datetime import datetime, timezone
from typing import Any, cast

import strawberry

from phoenix.core.model_schema import Dataset


@strawberry.input
class TimeRange:
    start: datetime = strawberry.field(
        description="The start of the time range",
    )
    end: datetime = strawberry.field(
        description="The end of the time range. Right exclusive.",
    )

    def __post_init__(self) -> None:
        setattr(
            self,
            "start",
            self.start.astimezone(timezone.utc),
        )
        setattr(
            self,
            "end",
            self.end.astimezone(timezone.utc),
        )

    def is_valid(self) -> bool:
        return self.start < self.end


def ensure_time_range(
    time_range: Any,
    dataset: Dataset,
) -> TimeRange:
    if not isinstance(time_range, TimeRange):
        start, stop = dataset.time_range
        time_range = TimeRange(start=start, end=stop)
    return cast(TimeRange, time_range)
