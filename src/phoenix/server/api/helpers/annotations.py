from uuid import uuid4

from strawberry.relay import GlobalID

NOTE_NAME = "note"
ANNOTATION_CONFIG_NOTE_ERROR = (
    "The name 'note' is reserved for notes and cannot be used for annotation configs."
)

CREATE_SPAN_NOTES_ERROR = (
    "The name 'note' is reserved for notes. Use the createSpanNotes mutation instead."
)
DELETE_SPAN_NOTES_ERROR = (
    "The name 'note' is reserved for notes. Use the deleteSpanNotes mutation instead."
)
CREATE_TRACE_NOTES_ERROR = (
    "The name 'note' is reserved for notes. Use the createTraceNotes mutation instead."
)
DELETE_TRACE_NOTES_ERROR = (
    "The name 'note' is reserved for notes. Use the deleteTraceNotes mutation instead."
)
CREATE_PROJECT_SESSION_NOTES_ERROR = (
    "The name 'note' is reserved for notes. Use the createProjectSessionNotes mutation instead."
)
DELETE_PROJECT_SESSION_NOTES_ERROR = (
    "The name 'note' is reserved for notes. Use the deleteProjectSessionNotes mutation instead."
)


def get_user_identifier(user_id: int) -> str:
    """
    Generates an annotation identifier unique to the user.
    """
    user_gid = str(GlobalID(type_name="User", node_id=str(user_id)))
    return f"px-app:{user_gid}"


def get_note_identifier(prefix: str) -> str:
    """
    Generates a UUIDv4 note identifier with the given prefix.
    """
    return f"{prefix}:{uuid4()}"
