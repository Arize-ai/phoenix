import strawberry
from strawberry.relay import Node, NodeID

from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.ExperimentRun import ExperimentRun


@strawberry.type
class ExperimentRunComparison(Node):
    id_attr: NodeID[int]
    example: DatasetExample
    runs: list[ExperimentRun]
