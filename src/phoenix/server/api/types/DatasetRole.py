from enum import Enum

import strawberry

import phoenix.core.model_schema as ms


@strawberry.enum
class DatasetRole(Enum):
    primary = ms.DatasetRole.PRIMARY
    reference = ms.DatasetRole.REFERENCE
