from enum import Enum, auto

import strawberry
from typing_extensions import assert_never

from phoenix.server.api.types.pagination import CursorSortColumnDataType
from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class ProjectSessionColumn(Enum):
    startTime = auto()
    endTime = auto()
    tokenCountTotal = auto()
    numTraces = auto()
    costTotal = auto()

    @property
    def data_type(self) -> CursorSortColumnDataType:
        if self is ProjectSessionColumn.tokenCountTotal or self is ProjectSessionColumn.numTraces:
            return CursorSortColumnDataType.INT
        if self is ProjectSessionColumn.startTime or self is ProjectSessionColumn.endTime:
            return CursorSortColumnDataType.DATETIME
        if self is ProjectSessionColumn.costTotal:
            return CursorSortColumnDataType.FLOAT
        assert_never(self)


@strawberry.input(description="The sort key and direction for ProjectSession connections.")
class ProjectSessionSort:
    col: ProjectSessionColumn
    dir: SortDir
