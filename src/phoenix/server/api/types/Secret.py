from datetime import datetime
from typing import TYPE_CHECKING, Annotated

import strawberry
from strawberry import lazy
from strawberry.relay import Node, NodeID
from strawberry.types import Info
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.auth import IsAdminIfAuthEnabled
from phoenix.server.api.context import Context

if TYPE_CHECKING:
    from .User import User


@strawberry.type
class DecryptedSecret:
    value: str


@strawberry.type
class UnparsableSecret:
    parse_error: str


ResolvedSecret: TypeAlias = Annotated[
    DecryptedSecret | UnparsableSecret,
    strawberry.union("ResolvedSecret", [DecryptedSecret, UnparsableSecret]),
]


@strawberry.type
class Secret(Node):
    id: NodeID[str]
    db_record: strawberry.Private[models.Secret | None] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.key:
            raise ValueError("Secret key mismatch")

    @strawberry.field
    async def key(self) -> str:
        return self.id

    @strawberry.field(permission_classes=[IsAdminIfAuthEnabled])  # type: ignore
    async def value(self, info: Info[Context, None]) -> ResolvedSecret:
        if self.db_record:
            raw_bytes = self.db_record.value
        else:
            raw_bytes = await info.context.data_loaders.secret_fields.load(
                (self.id, models.Secret.value)
            )
        try:
            decrypted_value = info.context.decrypt(raw_bytes).decode("utf-8")
        except Exception as e:
            return UnparsableSecret(parse_error=str(e))
        return DecryptedSecret(value=decrypted_value)

    @strawberry.field
    async def updated_at(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            val = self.db_record.updated_at
        else:
            val = await info.context.data_loaders.secret_fields.load(
                (self.id, models.Secret.updated_at)
            )
        return val

    @strawberry.field
    async def user(self, info: Info[Context, None]) -> Annotated["User", lazy(".User")] | None:
        if self.db_record:
            user_id = self.db_record.user_id
        else:
            user_id = await info.context.data_loaders.secret_fields.load(
                (self.id, models.Secret.user_id)
            )
        if user_id is None:
            return None
        from .User import User

        return User(id=user_id)
