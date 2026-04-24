from secrets import randbits
from time import time_ns
from uuid import UUID

from strawberry.relay import GlobalID


def get_user_identifier(user_id: int) -> str:
    """
    Generates an annotation identifier unique to the user.
    """
    user_gid = str(GlobalID(type_name="User", node_id=str(user_id)))
    return f"px-app:{user_gid}"


def get_note_identifier(prefix: str) -> str:
    """
    Generates a time-ordered UUIDv7 note identifier with the given prefix.
    """
    return f"{prefix}:{_uuid7()}"


def _uuid7() -> UUID:
    """
    Create an RFC 9562 UUIDv7 using the current Unix timestamp in milliseconds.

    Phoenix still supports Python 3.10, so we cannot rely on the standard library's
    uuid.uuid7() helper until the minimum supported Python version is 3.14+.
    """
    unix_ts_ms = time_ns() // 1_000_000
    rand_a = randbits(12)
    rand_b = randbits(62)
    uuid_int = (unix_ts_ms << 80) | (0x7 << 76) | (rand_a << 64) | (0b10 << 62) | rand_b
    return UUID(int=uuid_int)
