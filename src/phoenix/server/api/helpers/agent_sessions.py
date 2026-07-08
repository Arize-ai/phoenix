from datetime import datetime, timedelta
from typing import Optional

TURN_LOCK_STALENESS = timedelta(seconds=60)
"""How long after its last heartbeat a turn lock is considered abandoned."""


def is_turn_active(heartbeat_at: Optional[datetime], *, now: datetime) -> bool:
    """Whether a turn with a live (non-stale) heartbeat holds the session's lock.

    Shared by the REST session read and the GraphQL ``AgentSession`` type so
    every surface derives the busy state from one definition.
    """
    return heartbeat_at is not None and heartbeat_at >= now - TURN_LOCK_STALENESS
