# Part of the Phoenix PromptHub feature set

from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID


@strawberry.type
class Prompt(Node):
    id_attr: NodeID[int]
    name: str
    description: Optional[str]
    created_at: datetime
