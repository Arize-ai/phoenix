from enum import Enum

import strawberry

from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class ExperimentRunColumn(Enum):
    id = "id"


@strawberry.input(description="The sort key and direction for experiment run connections")
class ExperimentRunSort:
    col: ExperimentRunColumn
    dir: SortDir
