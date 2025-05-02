from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind


@strawberry.input
class PatchAnnotationInput:
    annotation_id: GlobalID
    name: Optional[str] = UNSET
    annotator_kind: Optional[AnnotatorKind] = UNSET
    label: Optional[str] = UNSET
    score: Optional[float] = UNSET
    explanation: Optional[str] = UNSET
    metadata: Optional[JSON] = UNSET
    identifier: Optional[str] = UNSET

    def __post_init__(self) -> None:
        if self.identifier == "":
            raise BadRequest("Identifier must be a non-empty string or null")
