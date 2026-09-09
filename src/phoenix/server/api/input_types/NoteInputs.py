from typing import Optional

import strawberry
from strawberry import ID, UNSET

from phoenix.server.api.exceptions import BadRequest


def _trim_note_input(
    note: str,
    identifier: Optional[str],
) -> tuple[str, Optional[str]]:
    note = note.strip()
    if not note:
        raise BadRequest("Note cannot be empty.")
    if isinstance(identifier, str):
        identifier = identifier.strip() or None
    return note, identifier


@strawberry.input
class CreateSpanNoteInput:
    id: ID
    note: str
    identifier: Optional[str] = UNSET

    def __post_init__(self) -> None:
        self.id = ID(str(self.id).strip())
        self.note, self.identifier = _trim_note_input(self.note, self.identifier)


@strawberry.input
class CreateTraceNoteInput:
    id: ID
    note: str
    identifier: Optional[str] = UNSET

    def __post_init__(self) -> None:
        self.id = ID(str(self.id).strip())
        self.note, self.identifier = _trim_note_input(self.note, self.identifier)


@strawberry.input
class CreateProjectSessionNoteInput:
    id: ID
    note: str
    identifier: Optional[str] = UNSET

    def __post_init__(self) -> None:
        self.id = ID(str(self.id).strip())
        self.note, self.identifier = _trim_note_input(self.note, self.identifier)
