"""Mutations for persisted assistant chat sessions."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import strawberry
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.config import (
    TEMPORARY_AGENT_SESSION_TIME_TO_LIVE_HOURS,
    get_env_phoenix_agents_assistant_project_name,
)
from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.server.api.auth import IsAgentAssistantEnabled, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AgentSession import AgentSession, to_gql_agent_session
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class CreateAgentSessionInput:
    title: str = strawberry.field(
        default="",
        description=("Optional initial title."),
    )
    temporary: bool = strawberry.field(
        default=False,
        description="Whether the session should expire after a period of inactivity.",
    )


@strawberry.type
class CreateAgentSessionMutationPayload:
    agent_session: AgentSession
    query: Query


@strawberry.input
class TruncateAgentSessionInput:
    id: GlobalID
    message_id: str = strawberry.field(
        description=(
            "The transcript message (UIMessage id) to rewind at. A user "
            "message is removed along with everything after it; an assistant "
            "message is kept and everything after it is removed."
        ),
    )


@strawberry.type
class TruncateAgentSessionMutationPayload:
    agent_session: AgentSession
    query: Query


@strawberry.input
class BranchAgentSessionInput:
    id: GlobalID
    message_id: str = strawberry.field(
        description=(
            "The transcript message (UIMessage id) to branch at. A user "
            "message is excluded from the branch along with everything after "
            "it; an assistant message is included and everything after it is "
            "excluded."
        ),
    )


@strawberry.type
class BranchAgentSessionMutationPayload:
    agent_session: AgentSession = strawberry.field(
        description="The newly created branch session.",
    )
    query: Query


@strawberry.input
class DeleteAgentSessionInput:
    id: GlobalID


@strawberry.type
class DeleteAgentSessionMutationPayload:
    deleted_agent_session_id: GlobalID
    query: Query


@strawberry.type
class AgentSessionMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAgentAssistantEnabled])  # type: ignore
    async def create_agent_session(
        self,
        info: Info[Context, None],
        input: CreateAgentSessionInput,
    ) -> CreateAgentSessionMutationPayload:
        """Create an empty persisted session owned by the viewer."""
        async with info.context.db() as session:
            agent_session = models.AgentSession(
                project_session_id=str(uuid4()),
                user_id=info.context.user_id,
                title=input.title.strip(),
                project_name=get_env_phoenix_agents_assistant_project_name(),
                expires_at=(
                    datetime.now(timezone.utc)
                    + timedelta(hours=TEMPORARY_AGENT_SESSION_TIME_TO_LIVE_HOURS)
                    if input.temporary
                    else None
                ),
            )
            session.add(agent_session)
            await session.flush()
        return CreateAgentSessionMutationPayload(
            agent_session=to_gql_agent_session(agent_session),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAgentAssistantEnabled])  # type: ignore
    async def truncate_agent_session(
        self,
        info: Info[Context, None],
        input: TruncateAgentSessionInput,
    ) -> TruncateAgentSessionMutationPayload:
        """Rewind a session's transcript in place at the given message."""
        try:
            agent_session_rowid = from_global_id_with_expected_type(
                input.id,
                models.AgentSession.__name__,
            )
        except ValueError as exc:
            raise BadRequest(str(exc)) from exc
        async with info.context.db() as session:
            agent_session = await _load_owned_agent_session(
                session,
                info=info,
                agent_session_rowid=agent_session_rowid,
                for_update=True,
            )
            target = (
                await session.execute(
                    select(
                        models.AgentSessionMessage.position,
                        models.AgentSessionMessage.message["role"].as_string(),
                    ).where(
                        models.AgentSessionMessage.agent_session_id == agent_session.id,
                        models.AgentSessionMessage.message_id == input.message_id,
                    )
                )
            ).one_or_none()
            if target is None:
                raise NotFound(f"No message found for ID '{input.message_id}'")
            target_position, target_role = target
            # A user target is removed along with everything after it; an
            # assistant target is kept, so deletion starts just after it.
            delete_from_position = target_position
            if target_role == "assistant":
                delete_from_position += 1
            await session.execute(
                delete(models.AgentSessionMessage).where(
                    models.AgentSessionMessage.agent_session_id == agent_session.id,
                    models.AgentSessionMessage.position >= delete_from_position,
                )
            )
            await session.execute(
                update(models.AgentSessionSnapshot)
                .where(
                    models.AgentSessionSnapshot.agent_session_id == agent_session.id,
                    or_(
                        models.AgentSessionSnapshot.compacted_through_position
                        >= delete_from_position,
                        models.AgentSessionSnapshot.compaction_event_position
                        >= delete_from_position,
                    ),
                )
                .values(
                    compaction_summary=None,
                    compacted_through_position=None,
                    compaction_event_position=None,
                    updated_at=func.now(),
                )
            )
            agent_session.updated_at = func.now()
        return TruncateAgentSessionMutationPayload(
            agent_session=AgentSession(id=agent_session.id),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAgentAssistantEnabled])  # type: ignore
    async def branch_agent_session(
        self,
        info: Info[Context, None],
        input: BranchAgentSessionInput,
    ) -> BranchAgentSessionMutationPayload:
        """Create a new session from a source session truncated at the given
        message, leaving the source untouched."""
        try:
            agent_session_rowid = from_global_id_with_expected_type(
                input.id,
                models.AgentSession.__name__,
            )
        except ValueError as exc:
            raise BadRequest(str(exc)) from exc
        async with info.context.db() as session:
            source_session = await _load_owned_agent_session(
                session,
                info=info,
                agent_session_rowid=agent_session_rowid,
            )
            message_prefix = await _load_session_message_prefix(
                session,
                agent_session_rowid=source_session.id,
                message_id=input.message_id,
            )
            if not message_prefix:
                raise NotFound(f"No message found for ID '{input.message_id}'")
            if message_prefix[-1].role == "user":
                message_prefix.pop()
            regenerated_messages = [
                message.model_copy(update={"id": str(uuid4())}) for message in message_prefix
            ]
            branch_session = models.AgentSession(
                project_session_id=str(uuid4()),
                user_id=info.context.user_id,
                title=source_session.title,
                project_name=get_env_phoenix_agents_assistant_project_name(),
                expires_at=(
                    datetime.now(timezone.utc)
                    + timedelta(hours=TEMPORARY_AGENT_SESSION_TIME_TO_LIVE_HOURS)
                    if source_session.expires_at is not None
                    else None
                ),
            )
            session.add(branch_session)
            await session.flush()
            session.add_all(
                models.AgentSessionMessage(
                    agent_session_id=branch_session.id,
                    position=position,
                    message=message,
                )
                for position, message in enumerate(regenerated_messages)
            )
        return BranchAgentSessionMutationPayload(
            agent_session=to_gql_agent_session(branch_session),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_agent_session(
        self,
        info: Info[Context, None],
        input: DeleteAgentSessionInput,
    ) -> DeleteAgentSessionMutationPayload:
        """Delete a persisted session along with its snapshot."""
        try:
            agent_session_rowid = from_global_id_with_expected_type(
                input.id,
                models.AgentSession.__name__,
            )
        except ValueError as exc:
            raise BadRequest(str(exc)) from exc
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


async def _load_owned_agent_session(
    session: AsyncSession,
    *,
    info: Info[Context, None],
    agent_session_rowid: int,
    for_update: bool = False,
) -> models.AgentSession:
    """Load a session the viewer owns, or raise a not-found error."""
    statement = select(models.AgentSession).where(models.AgentSession.id == agent_session_rowid)
    if for_update:
        statement = statement.with_for_update()
    agent_session = await session.scalar(statement)
    viewer_id = info.context.user_id
    if (
        agent_session is None
        or (viewer_id is not None and agent_session.user_id != viewer_id)
        or (
            agent_session.expires_at is not None
            and agent_session.expires_at <= datetime.now(timezone.utc)
        )
    ):
        raise NotFound(f"No agent session found for row ID '{agent_session_rowid}'")
    return agent_session


async def _load_session_message_prefix(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
    message_id: str,
) -> list[PhoenixUIMessage]:
    target_message = aliased(models.AgentSessionMessage)
    target_position = (
        select(target_message.position)
        .where(
            target_message.agent_session_id == agent_session_rowid,
            target_message.message_id == message_id,
        )
        .scalar_subquery()
    )
    return list(
        await session.scalars(
            select(models.AgentSessionMessage.message)
            .where(
                models.AgentSessionMessage.agent_session_id == agent_session_rowid,
                models.AgentSessionMessage.position <= target_position,
            )
            .order_by(models.AgentSessionMessage.position)
        )
    )
