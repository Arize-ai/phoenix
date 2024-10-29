from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON


@strawberry.input
class DatasetExampleInput:
    input: JSON
    output: JSON
    metadata: JSON
    span_id: Optional[GlobalID] = UNSET
