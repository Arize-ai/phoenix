"""Mutations for persisted assistant chat sessions."""

from typing import Optional, Sequence, get_args
from uuid import uuid4

import strawberry
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.config import get_env_phoenix_agents_assistant_project_name
from phoenix.db import models
from phoenix.db.types.data_stream_protocol import (
    DynamicToolOutputAvailablePart,
    DynamicToolOutputDeniedPart,
    DynamicToolOutputErrorPart,
    DynamicToolUIPart,
    PhoenixUIMessage,
    TextUIPart,
    ToolOutputAvailablePart,
    ToolOutputDeniedPart,
    ToolOutputErrorPart,
    ToolUIPart,
)
from phoenix.server.api.auth import IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AgentSession import AgentSession, to_gql_agent_session
from phoenix.server.api.types.node import from_global_id_with_expected_type

_TOOL_PART_TYPES = tuple(get_args(ToolUIPart)) + tuple(get_args(DynamicToolUIPart))

_TERMINAL_TOOL_PART_TYPES = (
    ToolOutputAvailablePart,
    ToolOutputErrorPart,
    ToolOutputDeniedPart,
    DynamicToolOutputAvailablePart,
    DynamicToolOutputErrorPart,
    DynamicToolOutputDeniedPart,
)

_BRANCH_TITLE_PREFIX = "(branch) "
_BRANCH_TITLE_MAX_LENGTH = 50


def _remove_pending_tool_parts(message: PhoenixUIMessage) -> PhoenixUIMessage:
    """Strip tool-call parts that never reached a terminal output state.

    Rewinding to an assistant turn must not leave dangling/pending tool calls
    behind, both because the UI would show stale approval affordances and
    because Anthropic rejects requests that contain unresolved tool calls.
    """
    return message.model_copy(
        update={
            "parts": [
                part
                for part in message.parts
                if not isinstance(part, _TOOL_PART_TYPES)
                or isinstance(part, _TERMINAL_TOOL_PART_TYPES)
            ]
        }
    )


def _rewind_messages(
    messages: Sequence[PhoenixUIMessage],
    message_id: str,
) -> Optional[list[PhoenixUIMessage]]:
    """Compute the transcript that results from rewinding (or branching) at the
    message with the given id.

    - **Assistant target**: keep everything up to and including the chosen
      assistant message, clearing any pending tool calls on that turn. The chat
      is reverted to the state it was in when that response completed.
    - **User target**: remove the chosen user message and everything after it.
      Restoring its text into the prompt input for editing/re-sending is the
      client's responsibility.

    Returns None when the id is not found.
    """
    target_index = next(
        (index for index, message in enumerate(messages) if message.id == message_id),
        None,
    )
    if target_index is None:
        return None
    target = messages[target_index]
    if target.role == "user":
        return list(messages[:target_index])
    retained = list(messages[: target_index + 1])
    retained[target_index] = _remove_pending_tool_parts(retained[target_index])
    return retained


def _build_branch_title(source_title: str, messages: Sequence[PhoenixUIMessage]) -> str:
    """Build the title for a session branched from a source conversation.

    Reuses the source's title when available, otherwise derives a short label
    from the branch's first user message, then prefixes it with ``(branch)``.
    Seeding a non-empty title also prevents the async summarizer from
    overwriting it on the branch's next turn.
    """
    base = source_title.strip()
    if not base:
        first_user_message = next(
            (message for message in messages if message.role == "user"),
            None,
        )
        if first_user_message is not None:
            text = " ".join(
                part.text for part in first_user_message.parts if isinstance(part, TextUIPart)
            ).strip()
            if len(text) > _BRANCH_TITLE_MAX_LENGTH:
                text = f"{text[:_BRANCH_TITLE_MAX_LENGTH]}..."
            base = text
    # Avoid stacking "(branch) (branch) ..." when branching from a branch.
    if base.startswith(_BRANCH_TITLE_PREFIX):
        return base
    return f"{_BRANCH_TITLE_PREFIX}{base}" if base else _BRANCH_TITLE_PREFIX.strip()


async def _load_owned_agent_session(
    session: AsyncSession,
    *,
    info: Info[Context, None],
    agent_session_gid: GlobalID,
) -> models.AgentSession:
    """Load a session the viewer owns, or raise a not-found error."""
    try:
        agent_session_rowid = from_global_id_with_expected_type(
            agent_session_gid,
            models.AgentSession.__name__,
        )
    except ValueError as exc:
        raise BadRequest(str(exc)) from exc
    agent_session = await session.get(models.AgentSession, agent_session_rowid)
    viewer_id = info.context.user_id
    if agent_session is None or (viewer_id is not None and agent_session.user_id != viewer_id):
        raise NotFound(f"No agent session found for ID '{agent_session_gid}'")
    return agent_session


async def _load_session_messages(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
) -> list[PhoenixUIMessage]:
    return list(
        await session.scalars(
            select(models.AgentSessionMessage.message)
            .where(models.AgentSessionMessage.agent_session_id == agent_session_rowid)
            .order_by(models.AgentSessionMessage.position)
        )
    )


def _message_rows(
    agent_session_rowid: int,
    messages: Sequence[PhoenixUIMessage],
) -> list[models.AgentSessionMessage]:
    return [
        models.AgentSessionMessage(
            agent_session_id=agent_session_rowid,
            position=position,
            message=message,
        )
        for position, message in enumerate(messages)
    ]


@strawberry.input
class CreateAgentSessionInput:
    title: str = strawberry.field(
        default="",
        description=("Optional initial title."),
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
            "The transcript message (UIMessage id) to branch at, using the "
            "same truncation contract as truncateAgentSession."
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
    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def create_agent_session(
        self,
        info: Info[Context, None],
        input: CreateAgentSessionInput,
    ) -> CreateAgentSessionMutationPayload:
        """Create an empty persisted session owned by the viewer."""
        if not info.context.settings.agent_assistant_enabled.enabled:
            raise BadRequest("Agents are disabled")
        async with info.context.db() as session:
            agent_session = models.AgentSession(
                project_session_id=str(uuid4()),
                user_id=info.context.user_id,
                title=input.title.strip(),
                project_name=get_env_phoenix_agents_assistant_project_name(),
            )
            session.add(agent_session)
            await session.flush()
        return CreateAgentSessionMutationPayload(
            agent_session=to_gql_agent_session(agent_session),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def truncate_agent_session(
        self,
        info: Info[Context, None],
        input: TruncateAgentSessionInput,
    ) -> TruncateAgentSessionMutationPayload:
        """Rewind a session's transcript in place at the given message."""
        if not info.context.settings.agent_assistant_enabled.enabled:
            raise BadRequest("Agents are disabled")
        async with info.context.db() as session:
            agent_session = await _load_owned_agent_session(
                session,
                info=info,
                agent_session_gid=input.id,
            )
            messages = await _load_session_messages(
                session,
                agent_session_rowid=agent_session.id,
            )
            rewound_messages = _rewind_messages(messages, input.message_id)
            if rewound_messages is None:
                raise NotFound(f"No message found for ID '{input.message_id}'")
            await session.execute(
                delete(models.AgentSessionMessage).where(
                    models.AgentSessionMessage.agent_session_id == agent_session.id
                )
            )
            session.add_all(_message_rows(agent_session.id, rewound_messages))
            await session.execute(
                update(models.AgentSession)
                .where(models.AgentSession.id == agent_session.id)
                .values(updated_at=func.now())
            )
        return TruncateAgentSessionMutationPayload(
            agent_session=AgentSession(id=agent_session.id),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def branch_agent_session(
        self,
        info: Info[Context, None],
        input: BranchAgentSessionInput,
    ) -> BranchAgentSessionMutationPayload:
        """Create a new session from a source session truncated at the given
        message, leaving the source untouched."""
        if not info.context.settings.agent_assistant_enabled.enabled:
            raise BadRequest("Agents are disabled")
        async with info.context.db() as session:
            source_session = await _load_owned_agent_session(
                session,
                info=info,
                agent_session_gid=input.id,
            )
            messages = await _load_session_messages(
                session,
                agent_session_rowid=source_session.id,
            )
            rewound_messages = _rewind_messages(messages, input.message_id)
            if rewound_messages is None:
                raise NotFound(f"No message found for ID '{input.message_id}'")
            branch_session = models.AgentSession(
                project_session_id=str(uuid4()),
                user_id=info.context.user_id,
                title=_build_branch_title(source_session.title, rewound_messages),
                # The branch continues the same conversation, so it stays in
                # the source's trace project even if configuration has changed.
                project_name=source_session.project_name,
            )
            session.add(branch_session)
            await session.flush()
            session.add_all(_message_rows(branch_session.id, rewound_messages))
        return BranchAgentSessionMutationPayload(
            agent_session=to_gql_agent_session(branch_session),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
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
