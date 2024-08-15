from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID

from .UserRole import UserRole


@strawberry.type
class User(Node):
    id_attr: NodeID[int]
    email: str
    username: Optional[str]
    created_at: datetime
    role: UserRole
