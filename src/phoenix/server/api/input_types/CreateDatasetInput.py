from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON


@strawberry.input
class CreateDatasetInput:
    name: str
    description: Optional[str] = UNSET
    metadata: Optional[JSON] = UNSET
