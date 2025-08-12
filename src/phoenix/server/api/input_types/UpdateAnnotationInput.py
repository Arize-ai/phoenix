from typing import Optional

import strawberry
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind


@strawberry.input
class UpdateAnnotationInput:
    annotation_id: GlobalID
    name: str
    annotator_kind: AnnotatorKind = AnnotatorKind.HUMAN
    label: Optional[str] = None
    score: Optional[float] = None
    explanation: Optional[str] = None
    metadata: JSON = strawberry.field(default_factory=dict)
    identifier: str = ""
    source: AnnotationSource = AnnotationSource.APP
