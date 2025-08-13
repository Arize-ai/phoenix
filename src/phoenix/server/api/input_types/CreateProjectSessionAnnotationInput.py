from typing import Optional

import strawberry
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind


@strawberry.input
class CreateProjectSessionAnnotationInput:
    project_session_id: GlobalID
    name: str
    annotator_kind: AnnotatorKind = AnnotatorKind.HUMAN
    label: Optional[str] = None
    score: Optional[float] = None
    explanation: Optional[str] = None
    metadata: JSON = strawberry.field(default_factory=dict)
    source: AnnotationSource = AnnotationSource.APP
    identifier: Optional[str] = strawberry.UNSET

    def __post_init__(self) -> None:
        self.name = self.name.strip()
        if isinstance(self.label, str):
            self.label = self.label.strip()
        if not self.label:
            self.label = None
        if isinstance(self.explanation, str):
            self.explanation = self.explanation.strip()
        if not self.explanation:
            self.explanation = None
        if isinstance(self.identifier, str):
            self.identifier = self.identifier.strip()
        if self.score is None and not self.label and not self.explanation:
            raise BadRequest("At least one of score, label, or explanation must be not null/empty.")
