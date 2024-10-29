import strawberry
from strawberry.relay import GlobalID

from .dataset_example import DatasetExample
from .experiment_run import ExperimentRun


@strawberry.type
class RunComparisonItem:
    experiment_id: GlobalID
    runs: list[ExperimentRun]


@strawberry.type
class ExperimentComparison:
    example: DatasetExample
    run_comparison_items: list[RunComparisonItem]
