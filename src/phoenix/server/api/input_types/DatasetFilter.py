from enum import Enum

import strawberry


@strawberry.enum
class DatasetFilterColumn(Enum):
    name = "name"


@strawberry.input(description="The filter key and value for dataset connections")
class DatasetFilter:
    col: DatasetFilterColumn
    value: str
