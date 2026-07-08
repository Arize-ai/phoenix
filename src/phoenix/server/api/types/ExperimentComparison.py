import strawberry
from strawberry.relay import Node, NodeID

from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.ExperimentRepeatedRunGroup import ExperimentRepeatedRunGroup


@strawberry.type
class ExperimentComparison(Node):
    id_attr: NodeID[int]
    example: DatasetExample
    repeated_run_groups: list[ExperimentRepeatedRunGroup]
