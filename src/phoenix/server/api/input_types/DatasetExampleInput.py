from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON


@strawberry.input
class DatasetExampleInput:
    input: JSON  # ty: ignore[invalid-type-form]
    output: JSON  # ty: ignore[invalid-type-form]
    metadata: JSON  # ty: ignore[invalid-type-form]
    span_id: Optional[GlobalID] = UNSET
