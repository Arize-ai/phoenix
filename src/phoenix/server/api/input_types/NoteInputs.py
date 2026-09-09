from typing import Optional

import strawberry
from strawberry import UNSET

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.EntityIdentifierInput import (
    ProjectSessionIdentifierInput,
    SpanIdentifierInput,
    TraceIdentifierInput,
)
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind


def _trim_note(note: str) -> str:
    note = note.strip()
    if not note:
        raise BadRequest("Note cannot be empty.")
    return note


def _trim_identifier(identifier: Optional[str]) -> Optional[str]:
    if isinstance(identifier, str):
        return identifier.strip() or None
    return identifier


@strawberry.input
class CreateSpanNoteInput:
    target: SpanIdentifierInput
    note: str
    annotator_kind: AnnotatorKind
    source: AnnotationSource
    identifier: Optional[str] = UNSET

    def __post_init__(self) -> None:
        self.note = _trim_note(self.note)
        self.identifier = _trim_identifier(self.identifier)


@strawberry.input
class CreateTraceNoteInput:
    target: TraceIdentifierInput
    note: str
    annotator_kind: AnnotatorKind
    source: AnnotationSource
    identifier: Optional[str] = UNSET

    def __post_init__(self) -> None:
        self.note = _trim_note(self.note)
        self.identifier = _trim_identifier(self.identifier)


@strawberry.input
class CreateProjectSessionNoteInput:
    target: ProjectSessionIdentifierInput
    note: str
    annotator_kind: AnnotatorKind
    source: AnnotationSource
    identifier: Optional[str] = UNSET

    def __post_init__(self) -> None:
        self.note = _trim_note(self.note)
        self.identifier = _trim_identifier(self.identifier)
