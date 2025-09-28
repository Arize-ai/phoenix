from enum import Enum, auto

import strawberry

from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class ExperimentRunMetric(Enum):
    tokenCountTotal = auto()
    latencyMs = auto()
    tokenCostTotal = auto()


@strawberry.input(one_of=True)
class ExperimentRunColumn:
    metric: ExperimentRunMetric
    annotation_name: str


@strawberry.input(description="The sort key and direction for experiment run connections")
class ExperimentRunSort:
    col: ExperimentRunColumn
    dir: SortDir
