from enum import Enum

import strawberry


@strawberry.enum
class EvaluatorFilterColumn(Enum):
    name = "name"


@strawberry.input(description="The filter key and value for evaluator connections")
class EvaluatorFilter:
    col: EvaluatorFilterColumn
    value: str
