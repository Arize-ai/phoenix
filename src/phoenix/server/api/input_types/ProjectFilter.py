from enum import Enum
from typing import Optional

import strawberry
from strawberry import UNSET

from phoenix.server.api.types.ProjectKind import ProjectKind


@strawberry.enum
class ProjectFilterColumn(Enum):
    name = "name"


@strawberry.input(description="A filter for project connections")
class ProjectFilter:
    col: Optional[ProjectFilterColumn] = None
    value: Optional[str] = None
    kinds: Optional[list[ProjectKind]] = strawberry.field(
        default=UNSET,
        description=(
            "Return only projects of these kinds. Defaults to standard and playground projects."
        ),
    )
