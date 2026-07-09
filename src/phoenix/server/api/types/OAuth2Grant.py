from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound, Unauthorized


@strawberry.type
class OAuth2Grant(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.OAuth2Grant]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("OAuth2Grant ID mismatch")

    async def _record(self, info: Info[Context, None]) -> models.OAuth2Grant:
        if self.db_record:
            return self.db_record
        async with info.context.db.read() as session:
            grant = await session.scalar(
                select(models.OAuth2Grant)
                .where(models.OAuth2Grant.id == self.id)
                .options(joinedload(models.OAuth2Grant.client))
            )
        if grant is None:
            raise NotFound(f"OAuth2 grant with id {self.id} not found")
        if info.context.auth_enabled and info.context.user_id != grant.user_id:
            raise Unauthorized("User not authorized to access OAuth2 grant")
        return grant

    @strawberry.field
    async def client_name(self, info: Info[Context, None]) -> str:
        grant = await self._record(info)
        return grant.client.name

    @strawberry.field
    async def is_first_party(self, info: Info[Context, None]) -> bool:
        grant = await self._record(info)
        return grant.client.is_first_party

    @strawberry.field
    async def client_id(self, info: Info[Context, None]) -> str:
        grant = await self._record(info)
        return grant.client.client_id

    @strawberry.field
    async def scopes(self, info: Info[Context, None]) -> list[str]:
        grant = await self._record(info)
        return list(grant.scopes or [])

    @strawberry.field
    async def created_at(self, info: Info[Context, None]) -> datetime:
        grant = await self._record(info)
        return grant.created_at

    @strawberry.field
    async def expires_at(self, info: Info[Context, None]) -> Optional[datetime]:
        grant = await self._record(info)
        return grant.expires_at

    @strawberry.field
    async def last_used_at(self, info: Info[Context, None]) -> Optional[datetime]:
        grant = await self._record(info)
        return grant.last_used_at
