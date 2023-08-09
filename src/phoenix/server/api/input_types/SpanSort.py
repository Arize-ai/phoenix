from enum import Enum

import strawberry

from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class SpanColumn(Enum):
    startTime = "startTime"


@strawberry.input
class SpanSort:
    """
    The sort column and direction for span connections
    """

    col: SpanColumn
    dir: SortDir
