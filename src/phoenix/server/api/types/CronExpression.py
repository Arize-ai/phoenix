from typing import NewType

import strawberry

from phoenix.db.types.trace_retention import TraceRetentionCronExpression

CronExpression = NewType("CronExpression", str)


def _parse_value(value: str) -> str:
    return TraceRetentionCronExpression.model_validate(value).root


cron_expression_scalar_definition = strawberry.scalar(
    name="CronExpression",
    parse_value=_parse_value,
)
