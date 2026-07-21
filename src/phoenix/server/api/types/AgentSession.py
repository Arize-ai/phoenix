from asyncio import gather
from datetime import datetime, timedelta, timezone
from typing import Optional

import strawberry
from sqlalchemy import select
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound


@strawberry.type
class AgentSession(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.AgentSession]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("AgentSession ID mismatch")

    def _not_found(self) -> NotFound:
        global_id = GlobalID(self.__class__.__name__, str(self.id))
        return NotFound(f"Unknown agent session: {global_id}")

    async def _ensure_access(self, info: Info[Context, None]) -> None:
        if not info.context.settings.agent_assistant_enabled.enabled:
            raise self._not_found()
        if self.db_record:
            agent_session_id = self.db_record.id
            owner_id = self.db_record.user_id
            expires_at = self.db_record.expires_at
        else:
            fields = info.context.data_loaders.agent_session_fields
            agent_session_id, owner_id, expires_at = await gather(
                fields.load((self.id, models.AgentSession.id)),
                fields.load((self.id, models.AgentSession.user_id)),
                fields.load((self.id, models.AgentSession.expires_at)),
            )
        viewer_id = info.context.user_id
        if agent_session_id is None or (viewer_id is not None and owner_id != viewer_id):
            raise self._not_found()
        if expires_at is not None and expires_at <= datetime.now(timezone.utc):
            raise self._not_found()

    @strawberry.field(
        description=("The title of the session."),
    )  # type: ignore
    async def title(self, info: Info[Context, None]) -> str:
        await self._ensure_access(info)
        if self.db_record:
            return self.db_record.title
        title = await info.context.data_loaders.agent_session_fields.load(
            (self.id, models.AgentSession.title),
        )
        assert isinstance(title, str)
        return title

    @strawberry.field
    async def created_at(self, info: Info[Context, None]) -> datetime:
        await self._ensure_access(info)
        if self.db_record:
            return self.db_record.created_at
        created_at = await info.context.data_loaders.agent_session_fields.load(
            (self.id, models.AgentSession.created_at),
        )
        assert isinstance(created_at, datetime)
        return created_at

    @strawberry.field
    async def updated_at(self, info: Info[Context, None]) -> datetime:
        await self._ensure_access(info)
        if self.db_record:
            return self.db_record.updated_at
        updated_at = await info.context.data_loaders.agent_session_fields.load(
            (self.id, models.AgentSession.updated_at),
        )
        assert isinstance(updated_at, datetime)
        return updated_at

    @strawberry.field(
        description="Whether the session expires after a period of inactivity.",
    )  # type: ignore
    async def is_temporary(self, info: Info[Context, None]) -> bool:
        await self._ensure_access(info)
        if self.db_record:
            return self.db_record.expires_at is not None
        expires_at = await info.context.data_loaders.agent_session_fields.load(
            (self.id, models.AgentSession.expires_at),
        )
        return expires_at is not None

    @strawberry.field(
        description=(
            "When the workspace retention policy will delete this session if it stays "
            "idle, derived from the last activity plus the admin-configured idle window. "
            "Null for temporary sessions and when idle-based retention is off."
        ),
    )  # type: ignore
    async def expires_at(self, info: Info[Context, None]) -> Optional[datetime]:
        await self._ensure_access(info)
        if self.db_record:
            stored_expires_at = self.db_record.expires_at
            updated_at = self.db_record.updated_at
        else:
            fields = info.context.data_loaders.agent_session_fields
            stored_expires_at, updated_at = await gather(
                fields.load((self.id, models.AgentSession.expires_at)),
                fields.load((self.id, models.AgentSession.updated_at)),
            )
        if stored_expires_at is not None:
            return None
        max_idle_days = info.context.settings.agent_session_retention.max_idle_days
        if max_idle_days <= 0:
            return None
        assert isinstance(updated_at, datetime)
        return updated_at + timedelta(days=max_idle_days)

    @strawberry.field(
        description="The persisted transcript as Vercel AI UIMessage JSON objects.",
    )  # type: ignore
    async def messages(self, info: Info[Context, None]) -> JSON:
        await self._ensure_access(info)
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
