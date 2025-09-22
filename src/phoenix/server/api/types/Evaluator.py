from enum import Enum

import strawberry
from strawberry.relay import Node, NodeID


@strawberry.enum
class EvaluatorKind(Enum):
    LLM = "LLM"
    CODE = "CODE"
    REMOTE = "REMOTE"


@strawberry.interface
class Evaluator(Node):
    id_attr: NodeID[int]
    name: str = strawberry.field(description="The name of the evaluator")
