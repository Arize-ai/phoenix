from datetime import datetime

import strawberry

from phoenix.server.api.interceptor import EnsureUTC


@strawberry.input
class TimeRange:
    start: datetime = strawberry.field(
        description="The start of the time range",
        default=EnsureUTC(),
    )
    end: datetime = strawberry.field(
        description="The end of the time range. Right exclusive.",
        default=EnsureUTC(),
    )

    def is_valid(self) -> bool:
        return self.start < self.end
