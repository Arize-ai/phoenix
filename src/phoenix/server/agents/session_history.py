from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import (
    CompactionMessageMetadata,
    PhoenixUIMessage,
    TextUIPart,
)


@dataclass(frozen=True)
class PersistedAgentSessionMessage:
    """An active transcript message with its durable position and row ID."""

    rowid: int
    position: int
    message: PhoenixUIMessage
    is_compaction_point: bool


@dataclass(frozen=True)
class AgentSessionHistory:
    """The active transcript beginning at the latest durable compaction point."""

    message_rows: tuple[PersistedAgentSessionMessage, ...]

    @property
    def messages(self) -> list[PhoenixUIMessage]:
        return [row.message for row in self.message_rows]

    @property
    def latest_compaction(self) -> PersistedAgentSessionMessage | None:
        first_row = self.message_rows[0] if self.message_rows else None
        return first_row if first_row is not None and first_row.is_compaction_point else None


async def load_agent_session_history(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
) -> AgentSessionHistory:
    """Load messages from a session's latest surviving compaction point onward."""
    compaction_message = models.AgentSessionMessage.__table__.alias("compaction_message")
    latest_compaction_position = (
        select(compaction_message.c.position)
        .join(
            models.AgentSessionCompactionPoint,
            models.AgentSessionCompactionPoint.agent_session_message_id == compaction_message.c.id,
        )
        .where(compaction_message.c.agent_session_id == agent_session_rowid)
        .order_by(compaction_message.c.position.desc())
        .limit(1)
        .scalar_subquery()
    )
    statement = (
        select(
            models.AgentSessionMessage.id,
            models.AgentSessionMessage.position,
            models.AgentSessionMessage.message,
            models.AgentSessionCompactionPoint.id.is_not(None).label("is_compaction_point"),
        )
        .outerjoin(
            models.AgentSessionCompactionPoint,
            models.AgentSessionCompactionPoint.agent_session_message_id
            == models.AgentSessionMessage.id,
        )
        .where(
            models.AgentSessionMessage.agent_session_id == agent_session_rowid,
            models.AgentSessionMessage.position >= func.coalesce(latest_compaction_position, 0),
        )
        .order_by(models.AgentSessionMessage.position)
    )
    rows = (await session.execute(statement)).tuples().all()
    return AgentSessionHistory(
        message_rows=tuple(
            PersistedAgentSessionMessage(
                rowid=rowid,
                position=position,
                message=message,
                is_compaction_point=is_compaction_point,
            )
            for rowid, position, message, is_compaction_point in rows
        )
    )


def build_compaction_message(*, message_id: str, summary: str) -> PhoenixUIMessage:
    """Build the durable user-role message used as a compaction checkpoint."""
    return PhoenixUIMessage(
        id=message_id,
        role="user",
        metadata=CompactionMessageMetadata(),
        parts=[TextUIPart(type="text", text=summary)],
    )


def get_compaction_summary(message: PhoenixUIMessage) -> str | None:
    """Return a compaction message's text summary, or None for a regular message."""
    if not isinstance(message.metadata, CompactionMessageMetadata):
        return None
    return "\n".join(part.text for part in message.parts if isinstance(part, TextUIPart))
