from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID


@strawberry.type
class PromptVersionTag(Node):
    id_attr: NodeID[int]
    name: str
    description: Optional[str] = None
