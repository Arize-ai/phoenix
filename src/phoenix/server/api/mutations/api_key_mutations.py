from datetime import datetime, timezone
from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db.models import UserRoleName
from phoenix.server.api.auth import IsAdmin, IsAuthEnabled, IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound, Unauthorized
from phoenix.server.api.helpers.api_key_policy import (
    can_revoke_user_api_key,
    get_api_key_owner,
    get_system_user_id,
    get_user_api_key_authorization,
    get_user_role,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.SystemApiKey import SystemApiKey
from phoenix.server.api.types.UserApiKey import UserApiKey
from phoenix.server.bearer_auth import PhoenixSystemUser, PhoenixUser
from phoenix.server.types import AccessTokenClaims, ApiKeyAttributes, ApiKeyClaims, ApiKeyId, UserId


def _reject_api_key_issuers(user: PhoenixUser) -> None:
    """
    Reject API-key-authenticated callers from credential issuance.

    An API key is a delegated credential. Allowing it to issue a replacement would let a
    compromised key preserve access after the original is revoked, so issuance must start
    from a human session (or, for system keys, the admin-secret principal). The
    admin-secret principal carries no token claims and is admitted here; each mutation
    applies its own authority checks to that principal.
    """
    if isinstance(user, PhoenixSystemUser):
        return
    if not isinstance(user.claims, AccessTokenClaims):
        raise Unauthorized("API keys cannot create API keys")


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
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAdmin, IsLocked])  # type: ignore
    async def create_system_api_key(
        self, info: Info[Context, None], input: CreateApiKeyInput
    ) -> CreateSystemApiKeyMutationPayload:
        assert (token_store := info.context.token_store) is not None
        if not isinstance((user := info.context.user), PhoenixUser):
            raise Unauthorized("User not found")
        _reject_api_key_issuers(user)
        user_role: UserRoleName = "SYSTEM"
        async with info.context.db() as session:
            system_user_id = await get_system_user_id(session)
            if system_user_id is None:
                raise ValueError("System user not found")
        issued_at = datetime.now(timezone.utc)
        claims = ApiKeyClaims(
            subject=UserId(system_user_id),
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
            api_key=SystemApiKey(id=int(token_id)),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsAuthEnabled, IsLocked])  # type: ignore
    async def create_user_api_key(
        self, info: Info[Context, None], input: CreateUserApiKeyInput
    ) -> CreateUserApiKeyMutationPayload:
        assert (token_store := info.context.token_store) is not None
        if not isinstance((user := info.context.user), PhoenixUser):
            raise Unauthorized("User not found")
        _reject_api_key_issuers(user)
        user_id = int(user.identity)
        async with info.context.db() as session:
            user_role = await get_user_role(session, user_id)
        if user_role is None:
            raise Unauthorized("User not found")
        if user_role == "SYSTEM":
            raise Unauthorized("System API keys cannot manage personal API keys")
        issued_at = datetime.now(timezone.utc)
        claims = ApiKeyClaims(
            subject=UserId(user_id),
            issued_at=issued_at,
            expiration_time=input.expires_at or None,
            attributes=ApiKeyAttributes(
                user_role=user_role,
                name=input.name,
                description=input.description,
            ),
        )
        token, token_id = await token_store.create_api_key(claims)
        return CreateUserApiKeyMutationPayload(
            jwt=token,
            api_key=UserApiKey(id=int(token_id)),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAdmin])  # type: ignore
    async def delete_system_api_key(
        self, info: Info[Context, None], input: DeleteApiKeyInput
    ) -> DeleteApiKeyMutationPayload:
        assert (token_store := info.context.token_store) is not None
        api_key_id = from_global_id_with_expected_type(
            input.id, expected_type_name=SystemApiKey.__name__
        )
        async with info.context.db() as session:
            owner = await get_api_key_owner(session, api_key_id)
        if owner is None or not owner.is_system:
            raise NotFound("API key not found")
        await token_store.revoke(ApiKeyId(api_key_id))
        return DeleteApiKeyMutationPayload(apiKeyId=input.id, query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsAuthEnabled])  # type: ignore
    async def delete_user_api_key(
        self, info: Info[Context, None], input: DeleteApiKeyInput
    ) -> DeleteApiKeyMutationPayload:
        assert (token_store := info.context.token_store) is not None
        api_key_id = from_global_id_with_expected_type(
            input.id, expected_type_name=UserApiKey.__name__
        )
        if not isinstance((user := info.context.user), PhoenixUser):
            raise NotFound("API key not found")
        caller_id = int(user.identity)
        # The admin-secret principal has no personal keys but carries configured admin
        # authority, so it may revoke another user's key despite its SYSTEM database role.
        caller_is_admin_secret = isinstance(user, PhoenixSystemUser)
        async with info.context.db() as session:
            authorization = await get_user_api_key_authorization(
                session,
                caller_id=caller_id,
                api_key_id=api_key_id,
            )
        if not can_revoke_user_api_key(
            caller_id=caller_id,
            caller_is_admin_secret=caller_is_admin_secret,
            authorization=authorization,
        ):
            raise NotFound("API key not found")
        await token_store.revoke(ApiKeyId(api_key_id))
        return DeleteApiKeyMutationPayload(apiKeyId=input.id, query=Query())
