from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID


@strawberry.type
class Dataset(Node):
    id_attr: NodeID[int]
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
