from enum import Enum

import strawberry


@strawberry.enum
class ProjectFilterColumn(Enum):
    name = "name"


@strawberry.input(description="The filter key and value for project connections")
class ProjectFilter:
    col: ProjectFilterColumn
    value: str
