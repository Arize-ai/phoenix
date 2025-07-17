import strawberry
from strawberry.relay import GlobalID, Node, NodeID

from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.ExperimentRun import ExperimentRun


@strawberry.type
class RunComparisonItem:
    experiment_id: GlobalID
    runs: list[ExperimentRun]


@strawberry.type
class ExperimentComparison(Node):
    id_attr: NodeID[int]
    example: DatasetExample
    run_comparison_items: list[RunComparisonItem]
