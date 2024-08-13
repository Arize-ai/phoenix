import strawberry
from strawberry import Private
from strawberry.relay.types import Node, NodeID

from .ApiKey import ApiKey


@strawberry.type
class UserApiKey(ApiKey, Node):
    id_attr: NodeID[int]
    user_id: Private[int]
