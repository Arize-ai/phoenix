import strawberry
from strawberry.relay import Node, NodeID


@strawberry.type
class UserRole(Node):
    id_attr: NodeID[int]
    name: str
