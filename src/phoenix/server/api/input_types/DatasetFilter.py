from enum import Enum

import strawberry


@strawberry.enum
class DatasetFilterColumn(Enum):
    name = "name"


@strawberry.input(description="A filter for datasets")
class DatasetFilter:
    col: DatasetFilterColumn
    value: str
