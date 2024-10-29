import strawberry
from strawberry.relay import Node, NodeID

from .api_key import ApiKey


@strawberry.type
class SystemApiKey(ApiKey, Node):
    id_attr: NodeID[int]
