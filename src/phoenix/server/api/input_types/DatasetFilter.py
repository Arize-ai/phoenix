from enum import Enum
from typing import Optional

import strawberry
from strawberry import UNSET


@strawberry.enum
class DatasetFilterColumn(Enum):
    name = "name"


@strawberry.input(description="A filter for datasets")
class DatasetFilter:
    col: Optional[DatasetFilterColumn] = None
    value: Optional[str] = None
    filter_labels: Optional[list[str]] = UNSET
