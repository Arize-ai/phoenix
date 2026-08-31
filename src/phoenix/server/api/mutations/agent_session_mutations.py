"""Mutations for persisted assistant chat sessions."""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

import strawberry
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.config import get_env_phoenix_agents_assistant_project_name
from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.server.agents.exceptions import ProviderNotFoundError
from phoenix.server.agents.model_selection import (
    AgentModelSelection as AgentModelSelectionModel,
)
from phoenix.server.agents.model_selection import (
    BuiltInProviderModelSelection,
    CustomProviderModelSelection,
)
from phoenix.server.agents.session_titles import (
    truncate_agent_session_title,
    validate_agent_session_title,
)
from phoenix.server.api.agent_helpers import get_agent_session_owner_filter
from phoenix.server.api.auth import (
    IsAgentAssistantEnabled,
    IsLocked,
    IsNotReadOnly,
    IsNotViewer,
)
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.agent_sessions import (
    is_turn_active,
    resolve_model_routing,
    set_session_model,
)
from phoenix.server.api.input_types.AgentModelSelectionInput import AgentModelSelectionInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AgentSession import AgentSession, to_gql_agent_session
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class CreateAgentSessionInput:
    model: AgentModelSelectionInput
    title: str = strawberry.field(
        default="",
        description=("Optional initial title."),
    )
    is_ephemeral: bool = strawberry.field(
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


@strawberry.input
class PatchAgentSessionInput:
    id: GlobalID
    title: Optional[str] = strawberry.field(
        default=UNSET,
        description="New title. Omitted leaves the title unchanged.",
    )
    model: Optional[AgentModelSelectionInput] = strawberry.field(
        default=UNSET,
        description="New model selection. Omitted leaves the model unchanged.",
    )


@strawberry.type
class PatchAgentSessionMutationPayload:
    agent_session: AgentSession
    query: Query


@strawberry.type
class DeleteAgentSessionMutationPayload:
    deleted_agent_session_id: GlobalID
    query: Query


@strawberry.type
class AgentSessionMutationMixin:
    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAgentAssistantEnabled, IsLocked]
    )  # type: ignore
    async def create_agent_session(
        self,
        info: Info[Context, None],
        input: CreateAgentSessionInput,
    ) -> CreateAgentSessionMutationPayload:
        """Create an empty persisted session owned by the viewer."""
        try:
            title = validate_agent_session_title(input.title, allow_empty=True)
        except ValueError as exc:
            raise BadRequest(str(exc)) from exc
        async with info.context.db() as session:
            try:
                routing = await resolve_model_routing(session, _to_model_selection(input.model))
            except ProviderNotFoundError as exc:
                raise NotFound(str(exc)) from exc
            agent_session = models.AgentSession(
                user_id=info.context.user_id,
                title=title,
                project_name=get_env_phoenix_agents_assistant_project_name(),
                is_ephemeral=input.is_ephemeral,
                model_provider=routing.model_provider,
                model_name=routing.model_name,
                custom_provider_id=routing.custom_provider_id,
            )
            session.add(agent_session)
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
            _ensure_agent_session_is_idle(agent_session)
            target = (
                await session.execute(
                    select(
                        models.AgentSessionMessage.id,
                        models.AgentSessionMessage.message["role"].as_string(),
                    ).where(
                        models.AgentSessionMessage.agent_session_id == agent_session.id,
                        models.AgentSessionMessage.message_id == input.message_id,
                    )
                )
            ).one_or_none()
            if target is None:
                raise NotFound(f"No message found for ID '{input.message_id}'")
            target_rowid, target_role = target
            # A user target is removed along with everything after it; an
            # assistant target is kept, so deletion starts just after it.
            delete_from_rowid = target_rowid
            if target_role == "assistant":
                delete_from_rowid += 1
            await session.execute(
                delete(models.AgentSessionMessage).where(
                    models.AgentSessionMessage.agent_session_id == agent_session.id,
                    models.AgentSessionMessage.id >= delete_from_rowid,
                )
            )
            agent_session.updated_at = func.now()
        return TruncateAgentSessionMutationPayload(
            agent_session=AgentSession(id=agent_session.id),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAgentAssistantEnabled, IsLocked]
    )  # type: ignore
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
                for_update=True,
            )
            _ensure_agent_session_is_idle(source_session)
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
                user_id=info.context.user_id,
                title=truncate_agent_session_title(source_session.title),
                project_name=get_env_phoenix_agents_assistant_project_name(),
                is_ephemeral=source_session.is_ephemeral,
                model_provider=source_session.model_provider,
                model_name=source_session.model_name,
                custom_provider_id=source_session.custom_provider_id,
            )
            session.add(branch_session)
            await session.flush()
            regenerated_message_rows = [
                models.AgentSessionMessage(
                    agent_session_id=branch_session.id,
                    message=message,
                )
                for message in regenerated_messages
            ]
            session.add_all(regenerated_message_rows)
        return BranchAgentSessionMutationPayload(
            agent_session=to_gql_agent_session(branch_session),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_agent_session(
        self,
        info: Info[Context, None],
        input: PatchAgentSessionInput,
    ) -> PatchAgentSessionMutationPayload:
        """Partially update a persisted session; omitted fields are left unchanged."""
        has_title = input.title is not UNSET and input.title is not None
        has_model = input.model is not UNSET and input.model is not None
        if not has_title and not has_model:
            raise BadRequest("At least one field to update must be provided.")
        title: Optional[str] = None
        if has_title:
            try:
                title = validate_agent_session_title(str(input.title), allow_empty=False)
            except ValueError as exc:
                raise BadRequest(str(exc)) from exc
        try:
            agent_session_rowid = from_global_id_with_expected_type(
                input.id,
                models.AgentSession.__name__,
            )
        except ValueError as exc:
            raise BadRequest(str(exc)) from exc
        lookup_stmt = select(models.AgentSession).where(
            models.AgentSession.id == agent_session_rowid
        )
        if (owner_filter := get_agent_session_owner_filter(info.context)) is not None:
            lookup_stmt = lookup_stmt.where(owner_filter)
        async with info.context.db() as session:
            agent_session = await session.scalar(lookup_stmt)
            if agent_session is None:
                raise NotFound(f"No agent session found for ID '{input.id}'")
            if title is not None:
                agent_session.title = title
            if has_model and input.model is not None:
                if is_turn_active(agent_session.heartbeat_at, now=datetime.now(timezone.utc)):
                    raise Conflict("Cannot change the session's model while a turn is streaming.")
                try:
                    await set_session_model(
                        session,
                        agent_session=agent_session,
                        model=_to_model_selection(input.model),
                    )
                except ProviderNotFoundError as exc:
                    raise NotFound(str(exc)) from exc
        return PatchAgentSessionMutationPayload(
            agent_session=to_gql_agent_session(agent_session),
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
        async with info.context.db() as session:
            agent_session = await _load_owned_agent_session(
                session,
                info=info,
                agent_session_rowid=agent_session_rowid,
                for_update=True,
            )
            _ensure_agent_session_is_idle(agent_session)
            agent_session_id = agent_session.id
            await session.execute(
                delete(models.AgentSession).where(models.AgentSession.id == agent_session_id)
            )
        return DeleteAgentSessionMutationPayload(
            deleted_agent_session_id=GlobalID(AgentSession.__name__, str(agent_session_id)),
            query=Query(),
        )


def _ensure_agent_session_is_idle(agent_session: models.AgentSession) -> None:
    if is_turn_active(agent_session.heartbeat_at, now=datetime.now(timezone.utc)):
        raise Conflict(
            "This session is busy. "
            "Wait for the current operation to finish before modifying the conversation."
        )


def _to_model_selection(input: AgentModelSelectionInput) -> AgentModelSelectionModel:
    if input.custom is not UNSET and input.custom is not None:
        return CustomProviderModelSelection(
            provider_type="custom",
            provider_id=str(input.custom.provider_id),
            model_name=input.custom.model_name,
        )
    if input.builtin is not UNSET and input.builtin is not None:
        return BuiltInProviderModelSelection(
            provider_type="builtin",
            provider=input.builtin.provider,
            model_name=input.builtin.model_name,
        )
    raise ValueError("Exactly one model selection must be provided.")


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
    auth_is_enforced = viewer_id is not None
    viewer_owns_session = agent_session is not None and agent_session.user_id == viewer_id
    if agent_session is None or (auth_is_enforced and not viewer_owns_session):
        raise NotFound(f"No agent session found for row ID '{agent_session_rowid}'")
    return agent_session


async def _load_session_message_prefix(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
    message_id: str,
) -> list[PhoenixUIMessage]:
    target_message = aliased(models.AgentSessionMessage)
    target_rowid = (
        select(target_message.id)
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
                models.AgentSessionMessage.id <= target_rowid,
            )
            .order_by(models.AgentSessionMessage.id)
        )
    )
