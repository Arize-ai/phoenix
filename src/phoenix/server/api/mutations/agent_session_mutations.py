"""Mutations for persisted assistant chat sessions."""

from datetime import datetime, timezone
from uuid import uuid4

import strawberry
from sqlalchemy import Select, delete, select
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.config import get_env_phoenix_agents_assistant_project_name
from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound, Unauthorized
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AgentSession import AgentSession, to_gql_agent_session
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class DeleteAgentSessionInput:
    id: GlobalID


@strawberry.input
class TruncateAgentSessionInput:
    id: GlobalID
    last_message_id: str | None


@strawberry.input
class ForkAgentSessionInput:
    source_session_id: GlobalID
    last_message_id: str | None


@strawberry.type
class DeleteAgentSessionMutationPayload:
    deleted_agent_session_id: GlobalID
    query: Query


@strawberry.type
class AgentSessionMutationPayload:
    agent_session: AgentSession
    query: Query


def _decode_agent_session_id(id: GlobalID) -> int:
    try:
        return from_global_id_with_expected_type(id, models.AgentSession.__name__)
    except ValueError as exc:
        raise BadRequest(str(exc)) from exc


def _owner_qualified_session_stmt(
    *,
    agent_session_rowid: int,
    viewer_id: int | None,
) -> Select[tuple[models.AgentSession]]:
    stmt = select(models.AgentSession).where(models.AgentSession.id == agent_session_rowid)
    if viewer_id is not None:
        stmt = stmt.where(models.AgentSession.user_id == viewer_id)
    return stmt


def _retained_message_count(
    *,
    messages: list[models.AgentSessionMessage],
    last_message_id: str | None,
) -> int:
    if last_message_id is None:
        return 0
    for index, message in enumerate(messages):
        if message.message.id == last_message_id:
            return index + 1
    raise BadRequest(f"Message '{last_message_id}' was not found in the agent session")


def _fork_title(title: str) -> str:
    title = title.strip()
    if title.startswith("(branch)"):
        return title
    return f"(branch) {title}".rstrip()


@strawberry.type
class AgentSessionMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def create_agent_session(
        self,
        info: Info[Context, None],
    ) -> AgentSessionMutationPayload:
        """Create an empty persisted session for a browser chat lifecycle."""
        if not info.context.settings.agent_assistant_enabled.enabled:
            raise Unauthorized("Agents are disabled")
        async with info.context.db() as session:
            agent_session = models.AgentSession(
                project_session_id=str(uuid4()),
                project_name=get_env_phoenix_agents_assistant_project_name(),
                user_id=info.context.user_id,
                title="",
            )
            session.add(agent_session)
            await session.flush()
        return AgentSessionMutationPayload(
            agent_session=to_gql_agent_session(agent_session),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_agent_session(
        self,
        info: Info[Context, None],
        input: DeleteAgentSessionInput,
    ) -> DeleteAgentSessionMutationPayload:
        """Delete a persisted session along with its snapshot."""
        agent_session_rowid = _decode_agent_session_id(input.id)
        lookup_stmt = _owner_qualified_session_stmt(
            agent_session_rowid=agent_session_rowid,
            viewer_id=info.context.user_id,
        ).with_only_columns(models.AgentSession.id)
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

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def truncate_agent_session(
        self,
        info: Info[Context, None],
        input: TruncateAgentSessionInput,
    ) -> AgentSessionMutationPayload:
        """Delete transcript messages after the selected retained message."""
        agent_session_rowid = _decode_agent_session_id(input.id)
        async with info.context.db() as session:
            agent_session = await session.scalar(
                _owner_qualified_session_stmt(
                    agent_session_rowid=agent_session_rowid,
                    viewer_id=info.context.user_id,
                )
            )
            if agent_session is None:
                raise NotFound(f"No agent session found for ID '{input.id}'")
            messages = list(
                await session.scalars(
                    select(models.AgentSessionMessage)
                    .where(models.AgentSessionMessage.agent_session_id == agent_session_rowid)
                    .order_by(models.AgentSessionMessage.position)
                )
            )
            retained_count = _retained_message_count(
                messages=messages,
                last_message_id=input.last_message_id,
            )
            if retained_count < len(messages):
                await session.execute(
                    delete(models.AgentSessionMessage).where(
                        models.AgentSessionMessage.agent_session_id == agent_session_rowid,
                        models.AgentSessionMessage.position >= retained_count,
                    )
                )
                await session.execute(
                    delete(models.AgentSessionSnapshot).where(
                        models.AgentSessionSnapshot.agent_session_id == agent_session_rowid
                    )
                )
                agent_session.updated_at = datetime.now(timezone.utc)
        return AgentSessionMutationPayload(
            agent_session=to_gql_agent_session(agent_session),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def fork_agent_session(
        self,
        info: Info[Context, None],
        input: ForkAgentSessionInput,
    ) -> AgentSessionMutationPayload:
        """Create a new session from a selected persisted transcript prefix."""
        source_session_rowid = _decode_agent_session_id(input.source_session_id)
        async with info.context.db() as session:
            source_session = await session.scalar(
                _owner_qualified_session_stmt(
                    agent_session_rowid=source_session_rowid,
                    viewer_id=info.context.user_id,
                )
            )
            if source_session is None:
                raise NotFound(f"No agent session found for ID '{input.source_session_id}'")
            source_messages = list(
                await session.scalars(
                    select(models.AgentSessionMessage)
                    .where(models.AgentSessionMessage.agent_session_id == source_session_rowid)
                    .order_by(models.AgentSessionMessage.position)
                )
            )
            retained_count = _retained_message_count(
                messages=source_messages,
                last_message_id=input.last_message_id,
            )
            forked_session = models.AgentSession(
                project_session_id=str(uuid4()),
                project_name=source_session.project_name,
                user_id=source_session.user_id,
                title=_fork_title(source_session.title),
            )
            session.add(forked_session)
            await session.flush()
            session.add_all(
                models.AgentSessionMessage(
                    agent_session_id=forked_session.id,
                    position=position,
                    message=source_message.message,
                )
                for position, source_message in enumerate(source_messages[:retained_count])
            )
        return AgentSessionMutationPayload(
            agent_session=to_gql_agent_session(forked_session),
            query=Query(),
        )
