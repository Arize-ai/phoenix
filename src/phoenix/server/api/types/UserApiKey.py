from datetime import datetime
from typing import TYPE_CHECKING, Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.types import Info
from typing_extensions import Annotated

from phoenix.db.models import ApiKey as OrmApiKey
from phoenix.server.api.context import Context

from .ApiKey import ApiKey

if TYPE_CHECKING:
    from .User import User


@strawberry.type
class UserApiKey(ApiKey, Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[OrmApiKey]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("UserApiKey ID mismatch")

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

    @strawberry.field
    async def user(
        self,
        info: Info[Context, None],
    ) -> Annotated["User", strawberry.lazy(".User")]:
        if self.db_record:
            user_id = self.db_record.user_id
        else:
            user_id = await info.context.data_loaders.user_api_key_fields.load(
                (self.id, OrmApiKey.user_id),
            )
        from .User import User

        return User(id=user_id)
