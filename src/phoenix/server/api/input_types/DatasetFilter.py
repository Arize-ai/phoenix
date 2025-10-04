from enum import Enum
from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID


@strawberry.enum
class DatasetFilterColumn(Enum):
    name = "name"


@strawberry.input(description="A filter for datasets")
class DatasetFilter:
    col: DatasetFilterColumn
    value: str
    labelIds: Optional[list[GlobalID]] = UNSET
