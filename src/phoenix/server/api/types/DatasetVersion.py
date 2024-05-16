from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON


@strawberry.type
class DatasetVersion(Node):
    id_attr: NodeID[int]
    description: Optional[str]
    metadata: JSON
    created_at: datetime
