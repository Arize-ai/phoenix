from enum import Enum

import strawberry

from phoenix.core.dataset_role import PRIMARY, REFERENCE


@strawberry.enum
class DatasetRole(Enum):
    primary = PRIMARY
    reference = REFERENCE
