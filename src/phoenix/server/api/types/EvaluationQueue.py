from datetime import datetime
from enum import Enum
from typing import Optional

import strawberry
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.types.Evaluator import EvaluationTarget
from phoenix.server.online_eval import queue_health

_DEGRADED_QUEUE_WAIT_MINUTES = int(queue_health.DEGRADED_QUEUE_WAIT.total_seconds() // 60)
_RATE_WINDOW_MINUTES = int(queue_health.RATE_WINDOW.total_seconds() // 60)


@strawberry.enum(description="Whether queued evaluations are running without long waits.")
class EvaluationQueueStatus(Enum):
    HEALTHY = strawberry.enum_value(
        "HEALTHY",
        description=(
            f"Evaluations not yet started have waited {_DEGRADED_QUEUE_WAIT_MINUTES} minutes "
            "or less, and new ones are being queued."
        ),
    )
    DEGRADED = strawberry.enum_value(
        "DEGRADED",
        description=(
            f"The oldest evaluation not yet started has waited over "
            f"{_DEGRADED_QUEUE_WAIT_MINUTES} minutes, or the queue is at capacity."
        ),
    )


async def _throughput(
    info: Info[Context, None], queue: queue_health.EvaluationQueue
) -> queue_health.QueueThroughput:
    return await info.context.data_loaders.evaluation_queue_throughput.load(queue)


@strawberry.type(
    description=(
        "The online evaluations of one evaluation target in the queue. Rates are per minute "
        f"over the last {_RATE_WINDOW_MINUTES} minutes."
    )
)
class EvaluationQueueTarget:
    queue: strawberry.Private[queue_health.EvaluationQueue]
    target: strawberry.Private[queue_health.TargetQueue]

    @strawberry.field
    def evaluation_target(self) -> EvaluationTarget:
        return EvaluationTarget(self.target.evaluation_target)

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations queued or running, including ones awaiting a retry."
    )
    def queued_count(self) -> int:
        return self.target.queued_count

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Queued evaluations awaiting a retry after an attempt that did not finish."
    )
    def retrying_count(self) -> int:
        return self.target.retrying_count

    @strawberry.field(  # type: ignore[untyped-decorator]
        description=(
            "When the longest-waiting evaluation not yet started was queued, or null if none "
            "is waiting. Evaluations awaiting a retry are not included."
        )
    )
    def oldest_queued_at(self) -> Optional[datetime]:
        return self.target.waiting.oldest_queued_at

    @strawberry.field(  # type: ignore[untyped-decorator]
        description=(
            "Evaluations queued per minute. While the queue is at capacity, this follows the "
            "rate evaluations leave it, not the rate they are owed."
        )
    )
    async def queued_per_minute(self, info: Info[Context, None]) -> float:
        throughput = await _throughput(info, self.queue)
        return throughput.target(self.target.evaluation_target).queued_per_minute

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations completed per minute, whether evaluated or failed."
    )
    async def evaluations_per_minute(self, info: Info[Context, None]) -> float:
        throughput = await _throughput(info, self.queue)
        return throughput.target(self.target.evaluation_target).evaluations_per_minute


@strawberry.type(
    description=(
        "The online evaluation queue. Span, trace, and session evaluations of every project "
        "on the server share it and its limit. Rates are per minute over the last "
        f"{_RATE_WINDOW_MINUTES} minutes."
    )
)
class EvaluationQueue:
    queue: strawberry.Private[queue_health.EvaluationQueue]

    @strawberry.field
    def status(self) -> EvaluationQueueStatus:
        return EvaluationQueueStatus(self.queue.status)

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations queued or running, including ones awaiting a retry."
    )
    def queued_count(self) -> int:
        return self.queue.queued_count

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="How many evaluations the queue holds before new ones wait to be queued."
    )
    def queued_limit(self) -> int:
        return self.queue.queued_limit

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Whether the queue is full, so new evaluations are not being queued."
    )
    def at_capacity(self) -> bool:
        return self.queue.at_capacity

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Queued evaluations awaiting a retry after an attempt that did not finish."
    )
    def retrying_count(self) -> int:
        return self.queue.retrying_count

    @strawberry.field(  # type: ignore[untyped-decorator]
        description=(
            "When the longest-waiting evaluation not yet started was queued, or null if none "
            "is waiting. Evaluations awaiting a retry are not included."
        )
    )
    def oldest_queued_at(self) -> Optional[datetime]:
        return self.queue.waiting.oldest_queued_at

    @strawberry.field(  # type: ignore[untyped-decorator]
        description=(
            "Evaluations queued per minute. While the queue is at capacity, this follows the "
            "rate evaluations leave it, not the rate they are owed."
        )
    )
    async def queued_per_minute(self, info: Info[Context, None]) -> float:
        return (await _throughput(info, self.queue)).queued_per_minute

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations completed per minute, whether evaluated or failed."
    )
    async def evaluations_per_minute(self, info: Info[Context, None]) -> float:
        return (await _throughput(info, self.queue)).evaluations_per_minute

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="The queue's evaluations of each evaluation target: span, trace, session."
    )
    def targets(self) -> list[EvaluationQueueTarget]:
        return [
            EvaluationQueueTarget(queue=self.queue, target=target) for target in self.queue.targets
        ]
