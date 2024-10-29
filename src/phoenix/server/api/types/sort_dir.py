from enum import Enum

import strawberry


@strawberry.enum
class SortDir(Enum):
    """
    Sort directions
    """

    asc = "asc"
    desc = "desc"
