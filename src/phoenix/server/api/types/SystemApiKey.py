from datetime import datetime
from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.db.models import ApiKey as OrmApiKey
from phoenix.server.api.context import Context

from .ApiKey import ApiKey


@strawberry.type
class SystemApiKey(ApiKey, Node):
    id: NodeID[int]
    db_record: strawberry.Private[OrmApiKey] = UNSET

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("SystemApiKey ID mismatch")

    @strawberry.field(description="Name of the API key.")  # type: ignore
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.user_api_key_fields.load(
                (self.id, OrmApiKey.name),
            )
        return val

    @strawberry.field(description="Description of the API key.")  # type: ignore
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.description
        else:
            val = await info.context.data_loaders.user_api_key_fields.load(
                (self.id, OrmApiKey.description),
            )
        return val

    @strawberry.field(description="The date and time the API key was created.")  # type: ignore
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.user_api_key_fields.load(
                (self.id, OrmApiKey.created_at),
            )
        return val

    @strawberry.field(description="The date and time the API key will expire.")  # type: ignore
    async def expires_at(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        if self.db_record:
            val = self.db_record.expires_at
        else:
            val = await info.context.data_loaders.user_api_key_fields.load(
                (self.id, OrmApiKey.expires_at),
            )
        return val
