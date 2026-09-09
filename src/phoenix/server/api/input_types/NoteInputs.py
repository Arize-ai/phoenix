from typing import Optional

import strawberry
from strawberry import ID, UNSET

from phoenix.server.api.exceptions import BadRequest


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
    id: ID = strawberry.field(description="The span's Relay node ID or OpenTelemetry span ID.")
    note: str
    identifier: Optional[str] = UNSET

    def __post_init__(self) -> None:
        self.id = ID(str(self.id).strip())
        self.note = _trim_note(self.note)
        self.identifier = _trim_identifier(self.identifier)


@strawberry.input
class CreateTraceNoteInput:
    id: ID = strawberry.field(description="The trace's Relay node ID or OpenTelemetry trace ID.")
    note: str
    identifier: Optional[str] = UNSET

    def __post_init__(self) -> None:
        self.id = ID(str(self.id).strip())
        self.note = _trim_note(self.note)
        self.identifier = _trim_identifier(self.identifier)


@strawberry.input
class CreateProjectSessionNoteInput:
    id: ID = strawberry.field(description="The session's Relay node ID or raw session ID.")
    note: str
    identifier: Optional[str] = UNSET

    def __post_init__(self) -> None:
        self.id = ID(str(self.id).strip())
        self.note = _trim_note(self.note)
        self.identifier = _trim_identifier(self.identifier)
