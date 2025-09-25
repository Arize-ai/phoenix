from enum import Enum

import strawberry
from strawberry.relay import Node, NodeID

from phoenix.db import models


@strawberry.enum
class EvaluatorKind(Enum):
    LLM = "LLM"
    CODE = "CODE"
    REMOTE = "REMOTE"


@strawberry.interface
class Evaluator(Node):
    id_attr: NodeID[int]
    name: str = strawberry.field(description="The name of the evaluator")


def to_gql_evaluator(eval: models.Evaluator) -> Evaluator:
    """Take a db evaluator and transform it to an evaluator"""
    return Evaluator(id_attr=eval.id, name=eval.name)
