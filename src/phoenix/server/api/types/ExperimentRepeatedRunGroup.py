import strawberry
from strawberry.relay import GlobalID

from phoenix.server.api.types.ExperimentRun import ExperimentRun


@strawberry.type
class RunComparisonItem:
    experiment_id: GlobalID
    runs: list[ExperimentRun]
