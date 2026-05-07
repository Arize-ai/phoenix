from typing import Optional
from uuid import uuid4

from strawberry.relay import GlobalID

USER_FEEDBACK_ANNOTATION_NAME = "user_feedback"
USER_FEEDBACK_POSITIVE_LABEL = "positive"
USER_FEEDBACK_NEGATIVE_LABEL = "negative"
USER_FEEDBACK_LABELS = frozenset((USER_FEEDBACK_POSITIVE_LABEL, USER_FEEDBACK_NEGATIVE_LABEL))
USER_FEEDBACK_SCORE_BY_LABEL = {
    USER_FEEDBACK_POSITIVE_LABEL: 1.0,
    USER_FEEDBACK_NEGATIVE_LABEL: 0.0,
}
ANONYMOUS_USER_FEEDBACK_IDENTIFIER = "px-app:anonymous"


def get_user_identifier(user_id: int) -> str:
    """
    Generates an annotation identifier unique to the user.
    """
    user_gid = str(GlobalID(type_name="User", node_id=str(user_id)))
    return f"px-app:{user_gid}"


def get_user_feedback_identifier(user_id: Optional[int]) -> str:
    """
    Generates the stable per-user identifier used for app-owned user feedback.
    """
    if user_id is None:
        return ANONYMOUS_USER_FEEDBACK_IDENTIFIER
    return get_user_identifier(user_id)


def get_note_identifier(prefix: str) -> str:
    """
    Generates a UUIDv4 note identifier with the given prefix.
    """
    return f"{prefix}:{uuid4()}"
