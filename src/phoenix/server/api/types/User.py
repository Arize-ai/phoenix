from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import select
from strawberry import Private
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.AuthMethod import AuthMethod
from phoenix.server.api.types.UserApiKey import UserApiKey, to_gql_api_key

from .UserRole import UserRole, to_gql_user_role


@strawberry.type
class User(Node):
    id_attr: NodeID[int]
    password_needs_reset: bool
    email: str
    username: str
    profile_picture_url: Optional[str]
    created_at: datetime
    user_role_id: Private[int]
    auth_method: AuthMethod

    @strawberry.field
    async def role(self, info: Info[Context, None]) -> UserRole:
        role = await info.context.data_loaders.user_roles.load(self.user_role_id)
        if role is None:
            raise NotFound(f"User role with id {self.user_role_id} not found")
        return to_gql_user_role(role)

    @strawberry.field
    async def api_keys(self, info: Info[Context, None]) -> list[UserApiKey]:
        async with info.context.db() as session:
            api_keys = await session.scalars(
                select(models.ApiKey).where(models.ApiKey.user_id == self.id_attr)
            )
        return [to_gql_api_key(api_key) for api_key in api_keys]


def to_gql_user(user: models.User, api_keys: Optional[list[models.ApiKey]] = None) -> User:
    """
    Converts an ORM user to a GraphQL user.
    """
    assert user.auth_method is not None
    return User(
        id_attr=user.id,
        password_needs_reset=user.reset_password,
        username=user.username,
        email=user.email,
        profile_picture_url=user.profile_picture_url,
        created_at=user.created_at,
        user_role_id=user.user_role_id,
        auth_method=AuthMethod(user.auth_method),
    )
