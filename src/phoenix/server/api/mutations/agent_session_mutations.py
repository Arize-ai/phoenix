"""Mutations for persisted assistant chat sessions."""

import strawberry
from sqlalchemy import delete
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.queries import Query


@strawberry.input
class DeleteAgentSessionInput:
    session_id: str


@strawberry.type
class DeleteAgentSessionMutationPayload:
    session_id: str
    query: Query


@strawberry.type
class AgentSessionMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_agent_session(
        self,
        info: Info[Context, None],
        input: DeleteAgentSessionInput,
    ) -> DeleteAgentSessionMutationPayload:
        """Delete a persisted session and all of its snapshots."""
        stmt = delete(models.AgentSession).where(
            models.AgentSession.session_uuid == input.session_id
        )
        if (viewer_id := info.context.user_id) is not None:
            stmt = stmt.where(models.AgentSession.user_id == viewer_id)
        async with info.context.db() as session:
            result = await session.execute(stmt)
        if result.rowcount == 0:  # type: ignore[attr-defined]
            raise NotFound(f"No agent session found for session ID '{input.session_id}'")
        return DeleteAgentSessionMutationPayload(
            session_id=input.session_id,
            query=Query(),
        )
