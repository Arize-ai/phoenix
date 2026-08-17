from uuid import uuid4

from strawberry.relay import GlobalID

from phoenix.db.eval_work import (
    ONLINE_EVAL_IDENTIFIER_PREFIX,
    is_reserved_annotation_identifier,
)
from phoenix.server.api.exceptions import BadRequest

RESERVED_ANNOTATION_IDENTIFIER = (
    f"Annotation identifiers starting with {ONLINE_EVAL_IDENTIFIER_PREFIX!r} are reserved for "
    f"evaluations Phoenix runs itself. Choose an identifier with a different prefix."
)


def raise_if_identifier_is_reserved(identifier: str) -> None:
    """Refuse an identifier only online evaluation may write.

    The prefix is what tells online evaluation's own annotations from everyone else's, so
    a client that could write it could exempt its annotations from every trigger and
    collide with the idempotency key online evaluation publishes under.

    Raises:
        BadRequest: the identifier is reserved.
    """
    if is_reserved_annotation_identifier(identifier):
        raise BadRequest(RESERVED_ANNOTATION_IDENTIFIER)


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
