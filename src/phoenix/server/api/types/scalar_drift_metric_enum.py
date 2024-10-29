from enum import Enum

import strawberry

from phoenix.metrics.metrics import PSI, JSDistance, KLDivergence


@strawberry.enum
class ScalarDriftMetric(Enum):
    psi = PSI
    klDivergence = KLDivergence
    jsDistance = JSDistance
