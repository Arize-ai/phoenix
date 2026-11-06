from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON


@strawberry.input
class PatchExperimentInput:
    experiment_id: GlobalID
    name: Optional[str] = UNSET
    description: Optional[str] = UNSET
    metadata: Optional[JSON] = UNSET
