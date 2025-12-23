from enum import Enum

import strawberry

from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class DatasetEvaluatorColumn(Enum):
    displayName = "display_name"
    kind = "kind"
    createdAt = "created_at"
    updatedAt = "updated_at"


@strawberry.input(description="The sort key and direction for evaluator connections")
class DatasetEvaluatorSort:
    col: DatasetEvaluatorColumn
    dir: SortDir
