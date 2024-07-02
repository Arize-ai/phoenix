from typing import List

import strawberry
from strawberry.relay import GlobalID

from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.ExperimentRun import ExperimentRun


@strawberry.type
class RunComparisonItem:
    experiment_id: GlobalID
    runs: List[ExperimentRun]


@strawberry.type
class ExperimentComparison:
    example: DatasetExample
    run_comparison_items: List[RunComparisonItem]
