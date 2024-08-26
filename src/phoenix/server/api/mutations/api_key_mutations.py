from datetime import datetime, timezone
from typing import Optional

import strawberry
from sqlalchemy import select
from strawberry import UNSET
from strawberry.types import Info

from phoenix.auth import ApiKeyAttributes, Claim, Issuer
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.mutations.auth import HasSecret, IsAdmin, IsAuthenticated, IsNotReadOnly
from phoenix.server.api.queries import Query
from phoenix.server.api.types.SystemApiKey import SystemApiKey


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
class ApiKeyMutationMixin:
    @strawberry.mutation(
        permission_classes=[
            IsNotReadOnly,
            HasSecret,
            IsNotReadOnly,
            IsAuthenticated,
            IsAdmin,
        ]
    )  # type: ignore
    async def create_system_api_key(
        self, info: Info[Context, None], input: CreateApiKeyInput
    ) -> CreateSystemApiKeyMutationPayload:
        assert (token_store := info.context.token_store) is not None
        user_role = "SYSTEM"
        async with info.context.db() as session:
            # Get the system user - note this could be pushed into a dataloader
            system_user = await session.scalar(
                select(models.User)
                .join(models.UserRole)  # Join User with UserRole
                .where(models.UserRole.name == user_role)  # Filter where role is SYSTEM
                .order_by(models.User.id)
                .limit(1)
            )
            if system_user is None:
                raise ValueError("System user not found")
        issued_at = datetime.now(timezone.utc)
        claims = Claim(
            user_id=system_user.id,
            issuer=Issuer.API_KEY,
            issued_at=issued_at,
            expiration_time=input.expires_at or None,
            attributes=ApiKeyAttributes(
                user_role=user_role,
                name=input.name,
                description=input.description,
            ),
        )
        token, id_attr = await token_store.create(claims)
        return CreateSystemApiKeyMutationPayload(
            jwt=token,
            api_key=SystemApiKey(
                id_attr=id_attr,
                name=input.name,
                description=input.description or None,
                created_at=issued_at,
                expires_at=input.expires_at or None,
            ),
            query=Query(),
        )
