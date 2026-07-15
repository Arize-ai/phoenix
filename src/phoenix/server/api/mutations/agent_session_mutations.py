"""Mutations for persisted assistant chat sessions."""

import strawberry
from sqlalchemy import delete, select
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AgentSession import AgentSession
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class DeleteAgentSessionInput:
    id: GlobalID


@strawberry.type
class DeleteAgentSessionMutationPayload:
    deleted_agent_session_id: GlobalID
    query: Query


@strawberry.type
class AgentSessionMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_agent_session(
        self,
        info: Info[Context, None],
        input: DeleteAgentSessionInput,
    ) -> DeleteAgentSessionMutationPayload:
        """Delete a persisted session along with its snapshot."""
        agent_session_rowid = from_global_id_with_expected_type(
            input.id,
            models.AgentSession.__name__,
        )
        lookup_stmt = select(models.AgentSession.id).where(
            models.AgentSession.id == agent_session_rowid
        )
        if (viewer_id := info.context.user_id) is not None:
            lookup_stmt = lookup_stmt.where(models.AgentSession.user_id == viewer_id)
        async with info.context.db() as session:
            agent_session_id = await session.scalar(lookup_stmt)
            if agent_session_id is not None:
                await session.execute(
                    delete(models.AgentSession).where(models.AgentSession.id == agent_session_id)
                )
        if agent_session_id is None:
            raise NotFound(f"No agent session found for ID '{input.id}'")
        return DeleteAgentSessionMutationPayload(
            deleted_agent_session_id=GlobalID(AgentSession.__name__, str(agent_session_id)),
            query=Query(),
        )
