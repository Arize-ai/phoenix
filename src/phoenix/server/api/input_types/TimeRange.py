from datetime import datetime

import strawberry
from typing_extensions import Annotated


@strawberry.input
class TimeRange:
    """
    TimeRange specifies the interval of time by which data is filtered. By
    convention, the end instant is excluded from the interval, i.e. TimeRange is
    a right-open interval.
    """

    start: datetime
    end: Annotated[
        datetime,
        strawberry.argument(
            description="The end instant is excluded from the TimeRange interval.",
        ),
    ]

    def is_valid(self) -> bool:
        return self.start < self.end
