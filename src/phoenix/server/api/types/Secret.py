import strawberry
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context


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

    @strawberry.field
    async def value(self, info: Info[Context, None]) -> str | None:
        if self.db_record:
            val = self.db_record.value
        else:
            val = await info.context.data_loaders.secret_values.load(self.id)
        if val:
            try:
                return info.context.decrypt(val).decode("utf-8")
            except Exception:
                pass
        return None
