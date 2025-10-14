from enum import Enum
from typing import Optional

import strawberry
from strawberry import UNSET


@strawberry.enum
class DatasetFilterColumn(Enum):
    name = "name"


@strawberry.input(description="A filter for datasets")
class DatasetFilter:
    col: DatasetFilterColumn
    value: str
    filter_labels: Optional[list[str]] = UNSET
