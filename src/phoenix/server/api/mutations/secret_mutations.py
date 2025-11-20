from datetime import datetime, timezone

import sqlalchemy as sa
import strawberry
from starlette.requests import Request
from strawberry import Info
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.api.auth import IsAdminIfAuthEnabled, IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Secret import Secret
from phoenix.server.bearer_auth import PhoenixUser


@strawberry.input
class UpsertSecretMutationInput:
    key: str
    value: str

    def __post_init__(self) -> None:
        self.key = self.key.strip()
        if not self.key:
            raise BadRequest("Key cannot be empty")
        self.value = self.value.strip()
        if not self.value:
            raise BadRequest("Value cannot be empty")


@strawberry.type
class UpsertSecretMutationPayload:
    secret: Secret
    query: Query


@strawberry.input
class DeleteSecretMutationInput:
    key: str

    def __post_init__(self) -> None:
        self.key = self.key.strip()
        if not self.key:
            raise BadRequest("Key cannot be empty")


@strawberry.type
class DeleteSecretMutationPayload:
    id: GlobalID
    query: Query


@strawberry.type
class SecretMutationMixin:
    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled, IsLocked]
    )  # type: ignore
    async def upsert_secret(
        self,
        info: Info[Context, None],
        input: UpsertSecretMutationInput,
    ) -> UpsertSecretMutationPayload:
        assert isinstance(request := info.context.request, Request)
        user_id: int | None = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)
        value = info.context.encrypt(input.value.encode("utf-8"))
        dialect = SupportedSQLDialect(info.context.db.dialect.name)
        stmt = insert_on_conflict(
            dict(
                key=input.key,
                value=value,
                deleted_at=None,
                user_id=user_id,
            ),
            dialect=dialect,
            table=models.Secret,
            unique_by=("key",),
            constraint_name="pk_secrets",
            on_conflict=OnConflict.DO_UPDATE,
        ).returning(models.Secret)
        async with info.context.db() as session:
            secret = await session.scalar(stmt)
        return UpsertSecretMutationPayload(
            secret=Secret(id=input.key, db_record=secret),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled])  # type: ignore
    async def delete_secret(
        self,
        info: Info[Context, None],
        input: DeleteSecretMutationInput,
    ) -> DeleteSecretMutationPayload:
        deleted_at = datetime.now(timezone.utc)
        stmt = (
            sa.update(models.Secret)
            .values(
                deleted_at=deleted_at,
                value=None,
            )
            .where(models.Secret.key == input.key)
        )
        async with info.context.db() as session:
            await session.execute(stmt)
        return DeleteSecretMutationPayload(
            id=GlobalID(type_name=Secret.__name__, node_id=input.key),
            query=Query(),
        )
