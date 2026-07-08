from uuid import uuid4

from strawberry.relay import GlobalID


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
