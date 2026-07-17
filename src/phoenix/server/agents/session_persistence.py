"""Helpers for persisting assistant agent sessions."""

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage


# TODO: Move this invariant into the ORM layer: https://github.com/Arize-ai/phoenix/issues/14495
def make_agent_session_message_row(
    *,
    agent_session_rowid: int,
    position: int,
    message: PhoenixUIMessage,
) -> models.AgentSessionMessage:
    """Build a row whose lookup ID matches the serialized message ID."""
    return models.AgentSessionMessage(
        agent_session_id=agent_session_rowid,
        position=position,
        message_id=message.id,
        message=message,
    )
