from typing import NewType

import strawberry

from phoenix.db.types.trace_retention import TraceRetentionCronExpression


def parse_value(value: str) -> str:
    return TraceRetentionCronExpression.model_validate(value).root


CronExpression = strawberry.scalar(
    NewType("CronExpression", str),
    parse_value=parse_value,
)
