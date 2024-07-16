from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON


@strawberry.input
class PatchAnnotationsInput:
    annotation_id: GlobalID
    name: Optional[str] = UNSET
    annotator_kind: Optional[str] = UNSET
    label: Optional[str] = UNSET
    score: Optional[float] = UNSET
    explanation: Optional[str] = UNSET
    metadata: Optional[JSON] = UNSET
