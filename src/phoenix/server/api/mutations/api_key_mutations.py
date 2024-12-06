from datetime import datetime, timezone
from typing import Optional

import strawberry
from sqlalchemy import select
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import enums, models
from phoenix.server.api.auth import IsAdmin, IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.SystemApiKey import SystemApiKey
from phoenix.server.api.types.UserApiKey import UserApiKey
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.types import ApiKeyAttributes, ApiKeyClaims, ApiKeyId, UserId


@strawberry.type
class CreateSystemApiKeyMutationPayload:
    jwt: str
    api_key: SystemApiKey
    query: Query


@strawberry.input
class CreateApiKeyInput:
    name: str
    description: Optional[str] = UNSET
    expires_at: Optional[datetime] = UNSET


@strawberry.type
class CreateUserApiKeyMutationPayload:
    jwt: str
    api_key: UserApiKey
    query: Query


@strawberry.input
class CreateUserApiKeyInput:
    name: str
    description: Optional[str] = UNSET
    expires_at: Optional[datetime] = UNSET


@strawberry.input
class DeleteApiKeyInput:
    id: GlobalID


@strawberry.type
class DeleteApiKeyMutationPayload:
    apiKeyId: GlobalID
    query: Query


@strawberry.type
class ApiKeyMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsAdmin, IsLocked])  # type: ignore
    async def create_system_api_key(
        self, info: Info[Context, None], input: CreateApiKeyInput
    ) -> CreateSystemApiKeyMutationPayload:
        assert (token_store := info.context.token_store) is not None
        user_role = enums.UserRole.SYSTEM
        async with info.context.db() as session:
            # Get the system user - note this could be pushed into a dataloader
            system_user = await session.scalar(
                select(models.User)
                .join(models.UserRole)  # Join User with UserRole
                .where(models.UserRole.name == user_role.value)  # Filter where role is SYSTEM
                .order_by(models.User.id)
                .limit(1)
            )
            if system_user is None:
                raise ValueError("System user not found")
        issued_at = datetime.now(timezone.utc)
        claims = ApiKeyClaims(
            subject=UserId(system_user.id),
            issued_at=issued_at,
            expiration_time=input.expires_at or None,
            attributes=ApiKeyAttributes(
                user_role=user_role,
                name=input.name,
                description=input.description,
            ),
        )
        token, token_id = await token_store.create_api_key(claims)
        return CreateSystemApiKeyMutationPayload(
            jwt=token,
            api_key=SystemApiKey(
                id_attr=int(token_id),
                name=input.name,
                description=input.description or None,
                created_at=issued_at,
                expires_at=input.expires_at or None,
            ),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def create_user_api_key(
        self, info: Info[Context, None], input: CreateUserApiKeyInput
    ) -> CreateUserApiKeyMutationPayload:
        assert (token_store := info.context.token_store) is not None
        try:
            user = info.context.request.user  # type: ignore
            assert isinstance(user, PhoenixUser)
        except AttributeError:
            raise ValueError("User not found")
        issued_at = datetime.now(timezone.utc)
        claims = ApiKeyClaims(
            subject=user.identity,
            issued_at=issued_at,
            expiration_time=input.expires_at or None,
            attributes=ApiKeyAttributes(
                user_role=enums.UserRole.MEMBER,
                name=input.name,
                description=input.description,
            ),
        )
        token, token_id = await token_store.create_api_key(claims)
        return CreateUserApiKeyMutationPayload(
            jwt=token,
            api_key=UserApiKey(
                id_attr=int(token_id),
                name=input.name,
                description=input.description or None,
                created_at=issued_at,
                expires_at=input.expires_at or None,
                user_id=int(user.identity),
            ),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsAdmin])  # type: ignore
    async def delete_system_api_key(
        self, info: Info[Context, None], input: DeleteApiKeyInput
    ) -> DeleteApiKeyMutationPayload:
        assert (token_store := info.context.token_store) is not None
        api_key_id = from_global_id_with_expected_type(
            input.id, expected_type_name=SystemApiKey.__name__
        )
        await token_store.revoke(ApiKeyId(api_key_id))
        return DeleteApiKeyMutationPayload(apiKeyId=input.id, query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_user_api_key(
        self, info: Info[Context, None], input: DeleteApiKeyInput
    ) -> DeleteApiKeyMutationPayload:
        assert (token_store := info.context.token_store) is not None
        api_key_id = from_global_id_with_expected_type(
            input.id, expected_type_name=UserApiKey.__name__
        )
        async with info.context.db() as session:
            api_key = await session.scalar(
                select(models.ApiKey).where(models.ApiKey.id == api_key_id)
            )
            if api_key is None:
                raise ValueError(f"API key with id {input.id} not found")
        if int((user := info.context.user).identity) != api_key.user_id and not user.is_admin:
            raise Unauthorized("User not authorized to delete")
        await token_store.revoke(ApiKeyId(api_key_id))
        return DeleteApiKeyMutationPayload(apiKeyId=input.id, query=Query())
