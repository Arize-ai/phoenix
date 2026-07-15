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
    title: str = strawberry.field(
        description=("The title of the session."),
    )
    created_at: datetime
    updated_at: datetime

    @strawberry.field(
        description="The persisted transcript as Vercel AI UIMessage JSON objects.",
    )  # type: ignore
    async def messages(self, info: Info[Context, None]) -> JSON:
        if not info.context.settings.agent_assistant_enabled.enabled:
            return cast(JSON, [])
        stmt = (
            select(models.AgentSessionMessage.message)
            .join(models.AgentSession)
            .where(models.AgentSession.id == self.id)
            .order_by(models.AgentSessionMessage.position)
        )
        if (viewer_id := info.context.user_id) is not None:
            stmt = stmt.where(models.AgentSession.user_id == viewer_id)
        async with info.context.db.read() as session:
            messages = (await session.scalars(stmt)).all()
        return cast(
            JSON,
            [
                message.model_dump(mode="json", by_alias=True, exclude_none=True)
                for message in messages
            ],
        )


def to_gql_agent_session(agent_session: models.AgentSession) -> AgentSession:
    return AgentSession(
        id=agent_session.id,
        title=agent_session.title,
        created_at=agent_session.created_at,
        updated_at=agent_session.updated_at,
    )
