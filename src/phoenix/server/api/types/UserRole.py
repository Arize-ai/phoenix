import strawberry
from strawberry.relay import Node, NodeID

from phoenix.db import models


@strawberry.type
class UserRole(Node):
    id_attr: NodeID[int]
    name: str


def to_gql_user_role(role: models.UserRole) -> UserRole:
    """Convert an ORM user role to a GraphQL user role."""
    return UserRole(id_attr=role.id, name=role.name)
