from datetime import datetime, timezone
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.TimeBinConfig import TimeBinConfig, TimeBucketSpec
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.online_eval import evaluation_activity

if TYPE_CHECKING:
    from .Evaluator import ProjectEvaluator
    from .Project import Project

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


def _project(project_id: int) -> "Project":
    from .Project import Project

    return Project(id=project_id)


def _project_evaluator(project_evaluator_id: Optional[int]) -> Optional["ProjectEvaluator"]:
    from .Evaluator import ProjectEvaluator

    return None if project_evaluator_id is None else ProjectEvaluator(id=project_evaluator_id)


@strawberry.type(
    description="One project evaluator's evaluation activity, or one project's, over the range."
)
class EvaluationActivityGroup:
    group: strawberry.Private[evaluation_activity.ActivityGroup]

    @strawberry.field
    def project(self) -> Annotated["Project", strawberry.lazy(".Project")]:
        return _project(self.group.project_id)

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="The project evaluator, when activity is grouped by project evaluator."
    )
    def project_evaluator(
        self,
    ) -> Optional[Annotated["ProjectEvaluator", strawberry.lazy(".Evaluator")]]:
        return _project_evaluator(self.group.project_evaluator_id)

    @strawberry.field(description="Evaluations that produced an annotation.")  # type: ignore
    def evaluated_count(self) -> int:
        return self.group.evaluated_count

    @strawberry.field(description="Evaluations given up on.")  # type: ignore
    def failed_count(self) -> int:
        return self.group.failed_count

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Lag of evaluations completed in the range; null if none completed."
    )
    def lag(self) -> Optional[EvaluationLag]:
        return to_gql_evaluation_lag(self.group.lag)

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Cost in USD of the evaluations' traces started in the range; null if none."
    )
    def cost(self) -> Optional[float]:
        return self.group.cost


@strawberry.type(description="One group's evaluation activity in one time bin.")
class EvaluationActivityBinGroup:
    group: strawberry.Private[evaluation_activity.ActivityBinGroup]

    @strawberry.field
    def project(self) -> Annotated["Project", strawberry.lazy(".Project")]:
        return _project(self.group.project_id)

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="The project evaluator, when activity is grouped by project evaluator."
    )
    def project_evaluator(
        self,
    ) -> Optional[Annotated["ProjectEvaluator", strawberry.lazy(".Evaluator")]]:
        return _project_evaluator(self.group.project_evaluator_id)

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations that produced an annotation in the bin."
    )
    def evaluated_count(self) -> int:
        return self.group.evaluated_count

    @strawberry.field(description="Evaluations given up on in the bin.")  # type: ignore
    def failed_count(self) -> int:
        return self.group.failed_count

    @strawberry.field(description="Evaluations queued in the bin.")  # type: ignore
    def queued_count(self) -> int:
        return self.group.queued_count

    @strawberry.field(  # type: ignore[untyped-decorator]
        description=(
            "95th percentile lag in seconds of evaluations completed in the bin; null if none."
        )
    )
    def lag_p95_seconds(self) -> Optional[float]:
        return self.group.lag_p95_seconds

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Cost in USD of the evaluations' traces started in the bin; null if none."
    )
    def cost(self) -> Optional[float]:
        return self.group.cost

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations queued or running at the end of the bin."
    )
    def queue_size(self) -> int:
        return self.group.queue_size


@strawberry.type(description="Evaluation activity in one time bin.")
class EvaluationActivityBin:
    bin: strawberry.Private[evaluation_activity.ActivityBin]

    @strawberry.field(description="The start of the bin.")  # type: ignore
    def timestamp(self) -> datetime:
        return self.bin.timestamp

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Groups with any activity in the bin, most evaluations over the range first."
    )
    def groups(self) -> list[EvaluationActivityBinGroup]:
        return [EvaluationActivityBinGroup(group=group) for group in self.bin.groups]


@strawberry.type(
    description=(
        "Online evaluation activity over a time range. Evaluations count when they complete, "
        "and lag runs from when an evaluation was queued to its result."
    )
)
class EvaluationActivity:
    activity: strawberry.Private[evaluation_activity.EvaluationActivity]

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Evaluations that produced an annotation in the range."
    )
    def evaluated_count(self) -> int:
        return self.activity.evaluated_count

    @strawberry.field(description="Evaluations given up on in the range.")  # type: ignore
    def failed_count(self) -> int:
        return self.activity.failed_count

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Lag of evaluations completed in the range; null if none completed."
    )
    def lag(self) -> Optional[EvaluationLag]:
        return to_gql_evaluation_lag(self.activity.lag)

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Cost in USD of the evaluations' traces started in the range; null if none."
    )
    def cost(self) -> Optional[float]:
        return self.activity.cost

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Activity per group, most evaluations first."
    )
    def groups(self) -> list[EvaluationActivityGroup]:
        return [EvaluationActivityGroup(group=group) for group in self.activity.groups]

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Activity per time bin, oldest first, with every bin in the range."
    )
    def series(self) -> list[EvaluationActivityBin]:
        return [EvaluationActivityBin(bin=activity_bin) for activity_bin in self.activity.series]


async def resolve_evaluation_activity(
    info: Info[Context, None],
    *,
    project_id: Optional[int],
    time_range: TimeRange,
    time_bin_config: Optional[TimeBinConfig],
) -> EvaluationActivity:
    if time_range.start is None:
        raise BadRequest("Start time is required")
    end = time_range.end or datetime.now(timezone.utc)
    if end <= time_range.start:
        raise BadRequest("End time must be after start time")
    activity = await evaluation_activity.load_evaluation_activity(
        info.context.db,
        project_id=project_id,
        start=time_range.start,
        end=end,
        time_bins=TimeBucketSpec.from_config(time_bin_config),
    )
    return EvaluationActivity(activity=activity)
