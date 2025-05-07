from enum import Enum

import strawberry

from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class ProjectColumn(Enum):
    createdAt = "created_at"
    updatedAt = "updated_at"
    name = "name"


@strawberry.input(description="The sort key and direction for project connections")
class ProjectSort:
    col: ProjectColumn
    dir: SortDir
