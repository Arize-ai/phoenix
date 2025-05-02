from typing import Optional

import strawberry
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind


@strawberry.input
class CreateSpanAnnotationInput:
    span_id: GlobalID
    name: str
    annotator_kind: AnnotatorKind
    label: Optional[str] = None
    score: Optional[float] = None
    explanation: Optional[str] = None
    metadata: JSON = strawberry.field(default_factory=dict)
    identifier: Optional[str] = None
    source: AnnotationSource

    def __post_init__(self) -> None:
        if self.identifier == "":
            raise BadRequest("Identifier must be a non-empty string or null")


@strawberry.input
class CreateSpanNoteInput:
    span_id: GlobalID
    note: str
