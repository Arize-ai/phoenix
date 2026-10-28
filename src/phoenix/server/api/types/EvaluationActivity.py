from typing import Optional

import strawberry

from phoenix.server.online_eval import evaluation_activity

EVALUATION_ACTIVITY_RETENTION_NOTE = (
    "Finished span evaluations are deleted once older than the online evaluation retention "
    "period, so a range reaching past it counts less than it covers."
)


@strawberry.type(description="Seconds from an evaluation being queued to its result.")
class EvaluationLag:
    p50_seconds: float = strawberry.field(description="Median lag, in seconds.")
    p95_seconds: float = strawberry.field(description="95th percentile lag, in seconds.")
    p99_seconds: float = strawberry.field(description="99th percentile lag, in seconds.")


def to_gql_evaluation_lag(
    lag: Optional[evaluation_activity.EvaluationLag],
) -> Optional[EvaluationLag]:
    if lag is None:
        return None
    return EvaluationLag(
        p50_seconds=lag.p50_seconds,
        p95_seconds=lag.p95_seconds,
        p99_seconds=lag.p99_seconds,
    )
