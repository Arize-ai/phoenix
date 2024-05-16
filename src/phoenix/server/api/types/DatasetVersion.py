import strawberry
from strawberry.relay import Node, NodeID


@strawberry.type
class DatasetVersion(Node):
    id_attr: NodeID[int]
