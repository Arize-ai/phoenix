import strawberry
from strawberry.relay import Node, NodeID


@strawberry.type
class ExperimentAnnotationSummary(Node):
    id_attr: NodeID[int]
    annotation_name: str
    mean_score: float
