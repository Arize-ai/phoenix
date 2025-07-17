from enum import Enum

import strawberry

from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class ProjectColumn(Enum):
    name = "name"
    endTime = "end_time"


@strawberry.input(description="The sort key and direction for project connections")
class ProjectSort:
    col: ProjectColumn
    dir: SortDir
