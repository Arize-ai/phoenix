from datetime import datetime, timezone
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from sqlalchemy import select
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.agent_helpers import CanAccessAgentSession
from phoenix.server.api.context import Context
from phoenix.server.api.helpers.agent_sessions import is_turn_active

if TYPE_CHECKING:
    from .User import User


@strawberry.type
class AgentSession(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.AgentSession]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("AgentSession ID mismatch")

    @strawberry.field(
        description=("The title of the session."),
        permission_classes=[CanAccessAgentSession],
    )  # type: ignore
    async def title(self, info: Info[Context, None]) -> str:
        if self.db_record:
            return self.db_record.title
        title = await info.context.data_loaders.agent_session_fields.load(
            (self.id, models.AgentSession.title),
        )
        assert isinstance(title, str)
        return title

    @strawberry.field(permission_classes=[CanAccessAgentSession])  # type: ignore
    async def created_at(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            return self.db_record.created_at
        created_at = await info.context.data_loaders.agent_session_fields.load(
            (self.id, models.AgentSession.created_at),
        )
        assert isinstance(created_at, datetime)
        return created_at

    @strawberry.field(permission_classes=[CanAccessAgentSession])  # type: ignore
    async def updated_at(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            return self.db_record.updated_at
        updated_at = await info.context.data_loaders.agent_session_fields.load(
            (self.id, models.AgentSession.updated_at),
        )
        assert isinstance(updated_at, datetime)
        return updated_at

    @strawberry.field(
        description="The user that owns the session.",
        permission_classes=[CanAccessAgentSession],
    )  # type: ignore
    async def user(
        self,
        info: Info[Context, None],
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        if self.db_record:
            user_id = self.db_record.user_id
        else:
            user_id = await info.context.data_loaders.agent_session_fields.load(
                (self.id, models.AgentSession.user_id),
            )
        if user_id is None:
            return None
        from .User import User

        return User(id=user_id)

    @strawberry.field(
        description="The text of the first user message in the session.",
        permission_classes=[CanAccessAgentSession],
    )  # type: ignore
    async def first_input(self, info: Info[Context, None]) -> Optional[str]:
        return await info.context.data_loaders.agent_session_first_inputs.load(self.id)

    @strawberry.field(
        description="The text of the latest assistant message in the session.",
        permission_classes=[CanAccessAgentSession],
    )  # type: ignore
    async def latest_output(self, info: Info[Context, None]) -> Optional[str]:
        return await info.context.data_loaders.agent_session_latest_outputs.load(self.id)

    @strawberry.field(
        description="Whether the session expires after a period of inactivity.",
        permission_classes=[CanAccessAgentSession],
    )  # type: ignore
    async def is_temporary(self, info: Info[Context, None]) -> bool:
        if self.db_record:
            return self.db_record.expires_at is not None
        expires_at = await info.context.data_loaders.agent_session_fields.load(
            (self.id, models.AgentSession.expires_at),
        )
        return expires_at is not None

    @strawberry.field(
        description=(
            "Whether a turn is currently streaming on this session, i.e. its "
            "turn lock has a live (non-stale) heartbeat."
        ),
        permission_classes=[CanAccessAgentSession],
    )  # type: ignore
    async def is_turn_active(self, info: Info[Context, None]) -> bool:
        if self.db_record:
            heartbeat_at = self.db_record.turn_lock_heartbeat_at
        else:
            heartbeat_at = await info.context.data_loaders.agent_session_fields.load(
                (self.id, models.AgentSession.turn_lock_heartbeat_at),
            )
        assert heartbeat_at is None or isinstance(heartbeat_at, datetime)
        return is_turn_active(heartbeat_at, now=datetime.now(timezone.utc))

    @strawberry.field(
        description="The persisted transcript as Vercel AI UIMessage JSON objects.",
        permission_classes=[CanAccessAgentSession],
    )  # type: ignore
    async def messages(self, info: Info[Context, None]) -> JSON:
        stmt = (
            select(models.AgentSessionMessage.message)
            .where(models.AgentSessionMessage.agent_session_id == self.id)
            .order_by(models.AgentSessionMessage.position)
        )
        async with info.context.db.read() as session:
            messages = (await session.scalars(stmt)).all()
        return JSON(
            [
                message.model_dump(mode="json", by_alias=True, exclude_none=True)
                for message in messages
            ],
        )


def to_gql_agent_session(agent_session: models.AgentSession) -> AgentSession:
    return AgentSession(
        id=agent_session.id,
        db_record=agent_session,
    )
