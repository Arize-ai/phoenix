from datetime import datetime, timedelta
from typing import Optional

TURN_LOCK_STALENESS = timedelta(seconds=60)
"""How long after its last heartbeat a turn lock is considered abandoned."""


def derive_otel_session_id(*, project_name: str, agent_session_rowid: int) -> str:
    """The OpenTelemetry ``session.id`` an agent session's traces are grouped under.

    Derived rather than stored: the session's autoincrementing primary key is
    already unique, so the only thing a column bought was a second source of
    truth to keep in sync. Qualifying the key with the project name keeps the id
    self-describing in the traces UI and keeps it from colliding with session ids
    minted by other producers writing into the same project.
    """
    return f"{project_name}:{agent_session_rowid}"


def is_turn_active(heartbeat_at: Optional[datetime], *, now: datetime) -> bool:
    """Whether a turn with a live (non-stale) heartbeat holds the session's lock.

    Shared by the REST session read and the GraphQL ``AgentSession`` type so
    every surface derives the busy state from one definition.
    """
    return heartbeat_at is not None and heartbeat_at >= now - TURN_LOCK_STALENESS
