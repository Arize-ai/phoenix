from datetime import datetime

import strawberry
from strawberry.relay.types import Node, NodeID
from strawberry.scalars import JSON


@strawberry.type
class DatasetExample(Node):
    id_attr: NodeID[int]
    input: JSON
    output: JSON
    metadata: JSON
    created_at: datetime
    updated_at: datetime
