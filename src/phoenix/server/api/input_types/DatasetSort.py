from enum import Enum

import strawberry

from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class DatasetColumn(Enum):
    createdAt = "created_at"
    name = "name"


@strawberry.input(description="The sort key and direction for dataset connections")
class DatasetSort:
    col: DatasetColumn
    dir: SortDir
