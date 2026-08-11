from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.config import get_env_admins
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound, Unauthorized
from phoenix.server.api.helpers.api_key_policy import get_user_role_and_api_keys
from phoenix.server.api.types.AuthMethod import AuthMethod
from phoenix.server.api.types.OAuth2Grant import OAuth2Grant, can_manage_grant
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
    ) -> str | None:
        if self.db_record:
            return self.db_record.email
        email: str | None = await info.context.data_loaders.user_fields.load(
            (self.id, models.User.email),
        )
        return email

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
        """Return the user's authentication method."""
        if self.db_record:
            auth_method_val = self.db_record.auth_method
        else:
            auth_method_val = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.auth_method),
            )
        return AuthMethod(auth_method_val)

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
        self._ensure_can_access_credentials(info)
        async with info.context.db.read() as session:
            user_role, api_keys = await get_user_role_and_api_keys(session, self.id)
        if user_role == "SYSTEM":
            return []
        return [UserApiKey(id=api_key.id, db_record=api_key) for api_key in api_keys]

    @strawberry.field
    async def oauth2_grants(self, info: Info[Context, None]) -> list[OAuth2Grant]:
        self._ensure_can_access_credentials(info)
        async with info.context.db.read() as session:
            grants = await session.scalars(
                select(models.OAuth2Grant)
                .where(models.OAuth2Grant.user_id == self.id)
                .where(models.OAuth2Grant.revoked_at.is_(None))
                .options(joinedload(models.OAuth2Grant.client))
                .order_by(models.OAuth2Grant.last_used_at.desc().nullslast())
            )
        return [OAuth2Grant(id=grant.id, db_record=grant) for grant in grants]

    @strawberry.field
    async def api_key_count(self, info: Info[Context, None]) -> int:
        self._ensure_can_access_credentials(info)
        counts = await info.context.data_loaders.user_credential_counts.load(self.id)
        return counts.api_key_count

    @strawberry.field
    async def oauth2_grant_count(self, info: Info[Context, None]) -> int:
        self._ensure_can_access_credentials(info)
        counts = await info.context.data_loaders.user_credential_counts.load(self.id)
        return counts.oauth2_grant_count

    def _ensure_can_access_credentials(self, info: Info[Context, None]) -> None:
        if can_manage_grant(info, self.id):
            return
        raise Unauthorized("User not authorized to access credentials")

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


def to_gql_user(record: Optional[models.User]) -> Optional[User]:
    """Resolves a user record, carrying it along so its fields need no further query."""
    if record is None:
        return None
    return User(id=record.id, db_record=record)
