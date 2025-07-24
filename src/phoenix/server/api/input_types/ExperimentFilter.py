from enum import Enum

import strawberry


@strawberry.enum
class ExperimentFilterColumn(Enum):
    name = "name"
    description = "description"


@strawberry.input(description="The filter key and value for experiment connections")
class ExperimentFilter:
    col: ExperimentFilterColumn
    value: str
