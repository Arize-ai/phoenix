from enum import Enum

import strawberry

from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class ExperimentColumn(Enum):
    # `sequenceNumber` is the 1-based, per-dataset ordinal (oldest = 1). It is
    # monotonic in the experiment's row id, so ordering by id reproduces it.
    sequenceNumber = "id"
    createdAt = "created_at"


@strawberry.input(description="The sort key and direction for experiment connections")
class ExperimentSort:
    col: ExperimentColumn
    dir: SortDir
