from enum import Enum

import strawberry


@strawberry.enum
class ProjectEvaluatorFilterColumn(Enum):
    name = "name"


@strawberry.input(description="The filter key and value for project evaluator connections")
class ProjectEvaluatorFilter:
    col: ProjectEvaluatorFilterColumn
    value: str
