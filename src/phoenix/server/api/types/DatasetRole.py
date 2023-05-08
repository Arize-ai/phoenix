from enum import Enum

import strawberry

from phoenix.core.model_schema import PRIMARY, REFERENCE


@strawberry.enum
class DatasetRole(Enum):
    primary = PRIMARY
    reference = REFERENCE
