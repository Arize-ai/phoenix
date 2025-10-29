from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import select
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.config import get_env_admins
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.AuthMethod import AuthMethod
from phoenix.server.api.types.UserApiKey import UserApiKey

from .UserRole import UserRole, to_gql_user_role


@strawberry.type
class User(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.User]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("User ID mismatch")

    @strawberry.field
    async def password_needs_reset(
        self,
        info: Info[Context, None],
    ) -> bool:
        if self.db_record:
            val = self.db_record.reset_password
        else:
            val = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.reset_password),
            )
        return val

    @strawberry.field
    async def email(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.email
        else:
            val = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.email),
            )
        return val

    @strawberry.field
    async def username(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.username
        else:
            val = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.username),
            )
        return val

    @strawberry.field
    async def profile_picture_url(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.profile_picture_url
        else:
            val = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.profile_picture_url),
            )
        return val

    @strawberry.field
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.created_at),
            )
        return val

    @strawberry.field
    async def auth_method(
        self,
        info: Info[Context, None],
    ) -> AuthMethod:
        if self.db_record:
            val = self.db_record.auth_method
        else:
            val = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.auth_method),
            )
        return AuthMethod(val)

    @strawberry.field
    async def role(self, info: Info[Context, None]) -> UserRole:
        if self.db_record:
            user_role_id = self.db_record.user_role_id
        else:
            user_role_id = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.user_role_id),
            )
        role = await info.context.data_loaders.user_roles.load(user_role_id)
        if role is None:
            raise NotFound(f"User role with id {user_role_id} not found")
        return to_gql_user_role(role)

    @strawberry.field
    async def api_keys(self, info: Info[Context, None]) -> list[UserApiKey]:
        async with info.context.db() as session:
            api_keys = await session.scalars(
                select(models.ApiKey).where(models.ApiKey.user_id == self.id)
            )
        return [UserApiKey(id=api_key.id, db_record=api_key) for api_key in api_keys]

    @strawberry.field
    async def is_management_user(self, info: Info[Context, None]) -> bool:
        initial_admins = get_env_admins()
        # this field is only visible to initial admins as they are the ones likely to have access to
        # a management interface / the phoenix environment.
        if self.db_record:
            email = self.db_record.email
        else:
            email = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.email),
            )
        if email in initial_admins or email == "admin@localhost":
            return True
        return False
