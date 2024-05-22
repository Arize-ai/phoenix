from datetime import datetime

import strawberry
from strawberry.relay.types import Node, NodeID
from strawberry.scalars import JSON


@strawberry.interface
class Example:
    input: JSON
    output: JSON
    metadata: JSON


@strawberry.type
class DatasetExample(Node, Example):
    id_attr: NodeID[int]
    created_at: datetime
