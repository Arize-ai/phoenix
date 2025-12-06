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
class SecretKeyValueInput:
    key: str
    value: str

    def __post_init__(self) -> None:
        self.key = self.key.strip()
        if not self.key:
            raise BadRequest("Key cannot be empty")
        self.value = self.value.strip()
        if not self.value:
            raise BadRequest("Value cannot be empty")


@strawberry.input
class UpsertSecretMutationInput:
    secrets: list[SecretKeyValueInput]

    def __post_init__(self) -> None:
        if not self.secrets:
            raise BadRequest("At least one secret is required")


@strawberry.type
class UpsertSecretMutationPayload:
    secrets: list[Secret]
    query: Query


@strawberry.input
class DeleteSecretMutationInput:
    keys: list[str]

    def __post_init__(self) -> None:
        self.keys = list({k.strip() for k in self.keys if k.strip()})
        if not self.keys:
            raise BadRequest("At least one key is required")


@strawberry.type
class DeleteSecretMutationPayload:
    ids: list[GlobalID]
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

        dialect = SupportedSQLDialect(info.context.db.dialect.name)
        records = [
            dict(
                key=secret_input.key,
                value=info.context.encrypt(secret_input.value.encode("utf-8")),
                user_id=user_id,
            )
            for secret_input in input.secrets
        ]
        stmt = insert_on_conflict(
            *records,
            dialect=dialect,
            table=models.Secret,
            unique_by=("key",),
            constraint_name="pk_secrets",
            on_conflict=OnConflict.DO_UPDATE,
        )
        async with info.context.db() as session:
            await session.execute(stmt)

        return UpsertSecretMutationPayload(
            secrets=[Secret(id=secret_input.key) for secret_input in input.secrets],
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled])  # type: ignore
    async def delete_secret(
        self,
        info: Info[Context, None],
        input: DeleteSecretMutationInput,
    ) -> DeleteSecretMutationPayload:
        keys = {k.strip() for k in input.keys if k.strip()}
        if not keys:
            raise BadRequest("At least one key is required")
        stmt = sa.delete(models.Secret).where(models.Secret.key.in_(keys))
        async with info.context.db() as session:
            await session.execute(stmt)
        return DeleteSecretMutationPayload(
            ids=[GlobalID(type_name=Secret.__name__, node_id=key) for key in keys],
            query=Query(),
        )
