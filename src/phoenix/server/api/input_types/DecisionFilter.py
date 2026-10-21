from enum import Enum

import strawberry


@strawberry.enum
class DecisionFilterColumn(Enum):
    name = "name"


@strawberry.input(description="The filter key and value for decision connections")
class DecisionFilter:
    col: DecisionFilterColumn
    value: str
