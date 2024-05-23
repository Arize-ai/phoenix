from datetime import datetime

import strawberry
from strawberry.relay.types import Node, NodeID

from .ExampleInterface import Example


@strawberry.type
class DatasetExample(Node, Example):
    id_attr: NodeID[int]
    created_at: datetime
