from enum import Enum

import strawberry

from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class TraceAnnotationColumn(Enum):
    createdAt = "created_at"
    name = "name"


@strawberry.input(description="The sort key and direction for TraceAnnotation connections")
class TraceAnnotationSort:
    col: TraceAnnotationColumn
    dir: SortDir
