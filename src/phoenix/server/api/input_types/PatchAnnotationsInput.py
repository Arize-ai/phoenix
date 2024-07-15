from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON


@strawberry.input
class PatchAnnotationsInput:
    annotation_id: strawberry.ID
    name: Optional[str] = UNSET
    annotator_kind: Optional[str] = UNSET
    label: Optional[str] = UNSET
    score: Optional[float] = UNSET
    explanation: Optional[str] = UNSET
    metadata: Optional[JSON] = UNSET
