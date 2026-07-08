"""GraphQL type for persisted assistant chat sessions.

Sessions are stored only in the database (``agent_sessions`` plus
point-in-time ``agent_session_snapshots``); the browser hydrates its
in-memory session list through these fields.
"""

from datetime import datetime
from typing import cast

import strawberry
from sqlalchemy import select
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context


@strawberry.type
class AgentSession(Node):
    id: NodeID[int]
    session_id: str = strawberry.field(
        description="The client-generated session ID.",
    )
    title: str = strawberry.field(
        description=("The title of the session."),
    )
    created_at: datetime
    updated_at: datetime

    @strawberry.field(
        description=(
            "The transcript from the session's latest snapshot, as a list of "
            "Vercel AI UIMessage JSON objects."
        ),
    )  # type: ignore
    async def messages(self, info: Info[Context, None]) -> JSON:
        async with info.context.db.read() as session:
            messages = await session.scalar(
                select(models.AgentSessionSnapshot.messages)
                .where(models.AgentSessionSnapshot.agent_session_id == self.id)
                .order_by(models.AgentSessionSnapshot.id.desc())
                .limit(1)
            )
        return cast(JSON, messages or [])


def to_gql_agent_session(agent_session: models.AgentSession) -> AgentSession:
    return AgentSession(
        id=agent_session.id,
        session_id=agent_session.session_uuid,
        title=agent_session.title,
        created_at=agent_session.created_at,
        updated_at=agent_session.updated_at,
    )
