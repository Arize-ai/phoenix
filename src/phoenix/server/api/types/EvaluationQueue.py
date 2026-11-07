from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.types.Evaluator import EvaluationTarget
from phoenix.server.online_eval import current_queue, throughput

if TYPE_CHECKING:
    from .Project import Project

_DEGRADED_QUEUE_WAIT_MINUTES = int(current_queue.DEGRADED_QUEUE_WAIT.total_seconds() // 60)
_RATE_WINDOW_MINUTES = int(throughput.RATE_WINDOW.total_seconds() // 60)
_COUNTS_STOP = f"Counts stop at {current_queue.MAX_QUEUE_COUNT:,}."
_COUNTS_AND_RATE_STOP = (
    f"Counts, and the evaluations added per {_RATE_WINDOW_MINUTES} minutes, stop at "
    f"{current_queue.MAX_QUEUE_COUNT:,}."
)


@strawberry.enum(description="Whether queued evaluations are running without long waits.")
class EvaluationQueueStatus(Enum):
    HEALTHY = strawberry.enum_value(
        "HEALTHY",
        description=(
            f"Evaluations not yet started have waited {_DEGRADED_QUEUE_WAIT_MINUTES} minutes "
            "or less."
        ),
    )
    DEGRADED = strawberry.enum_value(
        "DEGRADED",
        description=(
            f"The oldest evaluation not yet started has waited over "
            f"{_DEGRADED_QUEUE_WAIT_MINUTES} minutes."
        ),
    )


async def _throughput(
    info: Info[Context, None], queue: current_queue.EvaluationQueue
) -> throughput.QueueThroughput:
    return await info.context.data_loaders.evaluation_queue_throughput.load(queue)


async def _project_throughput(
    info: Info[Context, None], project_queue: current_queue.ProjectQueue
) -> throughput.Throughput:
    queue = await info.context.data_loaders.evaluation_queue.load(None)
    return (await _throughput(info, queue)).project(project_queue)


@strawberry.type(
    description=(
        "The online evaluations of one evaluation target in the queue. Rates are per minute "
        f"over the last {_RATE_WINDOW_MINUTES} minutes. {_COUNTS_AND_RATE_STOP}"
    )
)
class EvaluationQueueTarget:
    queue: strawberry.Private[current_queue.EvaluationQueue]
    target: strawberry.Private[current_queue.TargetQueue]

    @strawberry.field
    def evaluation_target(self) -> EvaluationTarget:
        return EvaluationTarget(self.target.evaluation_target)

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations queued or running, including ones awaiting a retry."
    )
    def queued_count(self) -> int:
        return self.target.queued_count

    @strawberry.field(  # type: ignore[untyped-decorator]
        description=(
            "When the longest-waiting evaluation not yet started was queued, or null if none "
            "is waiting. Evaluations awaiting a retry are not included."
        )
    )
    def oldest_waiting_at(self) -> Optional[datetime]:
        return self.target.oldest_waiting_at

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations added to the queue per minute."
    )
    async def added_per_minute(self, info: Info[Context, None]) -> float:
        throughput = await _throughput(info, self.queue)
        return throughput.target(self.target.evaluation_target).added_per_minute

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations completed per minute, whether evaluated or failed."
    )
    async def completed_per_minute(self, info: Info[Context, None]) -> float:
        throughput = await _throughput(info, self.queue)
        return throughput.target(self.target.evaluation_target).completed_per_minute


@strawberry.type(
    description=f"One project's evaluations in the online evaluation queue. {_COUNTS_STOP}"
)
class EvaluationQueueProject:
    project_id: strawberry.Private[int]
    queued_count: int = strawberry.field(
        description="Evaluations queued or running, including ones awaiting a retry."
    )

    @strawberry.field
    def project(self) -> Annotated["Project", strawberry.lazy(".Project")]:
        from .Project import Project

        return Project(id=self.project_id)


@strawberry.type(
    description=(
        "The online evaluation queue. Span, trace, and session evaluations of every project "
        "on the server share it. Rates are per minute over the last "
        f"{_RATE_WINDOW_MINUTES} minutes. {_COUNTS_AND_RATE_STOP}"
    )
)
class EvaluationQueue:
    queue: strawberry.Private[current_queue.EvaluationQueue]

    @strawberry.field
    def status(self) -> EvaluationQueueStatus:
        return EvaluationQueueStatus(self.queue.status)

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations queued or running, including ones awaiting a retry."
    )
    def queued_count(self) -> int:
        return self.queue.queued_count

    @strawberry.field(  # type: ignore[untyped-decorator]
        description=(
            "Queued evaluations running now. Clearing the queue removes the queued "
            "evaluations that are not running."
        )
    )
    def running_count(self) -> int:
        return self.queue.running_count

    @strawberry.field(  # type: ignore[untyped-decorator]
        description=(
            "When the longest-waiting evaluation not yet started was queued, or null if none "
            "is waiting. Evaluations awaiting a retry are not included."
        )
    )
    def oldest_waiting_at(self) -> Optional[datetime]:
        return self.queue.oldest_waiting_at

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations added to the queue per minute."
    )
    async def added_per_minute(self, info: Info[Context, None]) -> float:
        return (await _throughput(info, self.queue)).added_per_minute

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations completed per minute, whether evaluated or failed."
    )
    async def completed_per_minute(self, info: Info[Context, None]) -> float:
        return (await _throughput(info, self.queue)).completed_per_minute

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="The queue's evaluations of each evaluation target: span, trace, session."
    )
    def targets(self) -> list[EvaluationQueueTarget]:
        return [
            EvaluationQueueTarget(queue=self.queue, target=target) for target in self.queue.targets
        ]

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="The projects with the most evaluations in the queue, most first."
    )
    async def projects(
        self,
        info: Info[Context, None],
        first: Annotated[int, strawberry.argument(description="How many projects to return.")] = 5,
    ) -> list[EvaluationQueueProject]:
        if first < 0:
            raise BadRequest("first must not be negative")
        queued = await info.context.data_loaders.evaluation_queue_projects.load(first)
        return [
            EvaluationQueueProject(project_id=project.project_id, queued_count=project.queued_count)
            for project in queued
        ]


@strawberry.type(
    description=(f"One project's evaluations of one evaluation target in the queue. {_COUNTS_STOP}")
)
class ProjectEvaluationQueueTarget:
    target: strawberry.Private[current_queue.ProjectTargetQueue]

    @strawberry.field
    def evaluation_target(self) -> EvaluationTarget:
        return EvaluationTarget(self.target.evaluation_target)

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations queued or running, including ones awaiting a retry."
    )
    def queued_count(self) -> int:
        return self.target.queued_count


@strawberry.type(
    description=(
        "One project's part of the online evaluation queue: the span, trace, and session "
        "evaluations of its evaluators. Rates are per minute over the last "
        f"{_RATE_WINDOW_MINUTES} minutes. {_COUNTS_AND_RATE_STOP}"
    )
)
class ProjectEvaluationQueue:
    queue: strawberry.Private[current_queue.ProjectQueue]

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations queued or running, including ones awaiting a retry."
    )
    def queued_count(self) -> int:
        return self.queue.queued_count

    @strawberry.field(  # type: ignore[untyped-decorator]
        description=(
            "Queued evaluations running now. Clearing the queue removes the queued "
            "evaluations that are not running."
        )
    )
    def running_count(self) -> int:
        return self.queue.running_count

    @strawberry.field(  # type: ignore[untyped-decorator]
        description=(
            "When the longest-waiting evaluation not yet started was queued, or null if none "
            "is waiting. Evaluations awaiting a retry are not included."
        )
    )
    def oldest_waiting_at(self) -> Optional[datetime]:
        return self.queue.oldest_waiting_at

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations added to the queue per minute."
    )
    async def added_per_minute(self, info: Info[Context, None]) -> float:
        return (await _project_throughput(info, self.queue)).added_per_minute

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations completed per minute, whether evaluated or failed."
    )
    async def completed_per_minute(self, info: Info[Context, None]) -> float:
        return (await _project_throughput(info, self.queue)).completed_per_minute

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="This project's evaluations of each evaluation target: span, trace, session."
    )
    def targets(self) -> list[ProjectEvaluationQueueTarget]:
        return [ProjectEvaluationQueueTarget(target=target) for target in self.queue.targets]
