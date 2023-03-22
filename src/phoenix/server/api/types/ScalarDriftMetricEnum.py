from enum import Enum

import strawberry


@strawberry.enum
class ScalarDriftMetric(Enum):
    psi = "PSI"
    klDivergence = "KLDivergence"
    jsDistance = "JSDistance"
