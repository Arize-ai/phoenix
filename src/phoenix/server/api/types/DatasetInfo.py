from datetime import datetime

import strawberry


@strawberry.type
class DatasetInfo:
    start_time: datetime = strawberry.field(description="The start bookend of the data")
    end_time: datetime = strawberry.field(description="The end bookend of the data")
    record_count: int = strawberry.field(description="The record count of the data")
