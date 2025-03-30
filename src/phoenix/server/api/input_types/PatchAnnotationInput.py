from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.types.AnnotatorKind import AnnotatorKind


@strawberry.input
class PatchAnnotationInput:
    annotation_id: GlobalID
    name: str = UNSET
    annotator_kind: AnnotatorKind = UNSET
    label: Optional[str] = UNSET
    score: Optional[float] = UNSET
    explanation: Optional[str] = UNSET
    metadata: JSON = UNSET
    identifier: Optional[str] = UNSET
