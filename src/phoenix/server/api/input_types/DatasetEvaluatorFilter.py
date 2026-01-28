from enum import Enum

import strawberry


@strawberry.enum
class DatasetEvaluatorFilterColumn(Enum):
    name = "name"


@strawberry.input(description="The filter key and value for dataset evaluator connections")
class DatasetEvaluatorFilter:
    col: DatasetEvaluatorFilterColumn
    value: str
