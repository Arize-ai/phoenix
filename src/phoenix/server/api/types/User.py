from datetime import datetime
from typing import List, Optional

import strawberry
from strawberry import Private
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.ApiKey import ApiKey, to_gql_api_key

from .UserRole import UserRole, to_gql_user_role


@strawberry.type
class User(Node):
    id_attr: NodeID[int]
    email: str
    username: Optional[str]
    created_at: datetime
    user_role_id: Private[int]
    api_keys: Optional[List[ApiKey]] = strawberry.field(
        default_factory=list, description="API keys associated with the user."
    )

    @strawberry.field
    async def role(self, info: Info[Context, None]) -> UserRole:
        role = await info.context.data_loaders.user_roles.load(self.user_role_id)
        if role is None:
            raise NotFound(f"User role with id {self.user_role_id} not found")
        return to_gql_user_role(role)


def to_gql_user(user: models.User, api_keys: Optional[List[models.ApiKey]] = None) -> User:
    """
    Converts an ORM user to a GraphQL user.
    """
    if api_keys is None:
        gql_api_keys = []
    else:
        gql_api_keys = [to_gql_api_key(api_key) for api_key in api_keys]
    return User(
        id_attr=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at,
        user_role_id=user.user_role_id,
        api_keys=gql_api_keys,
    )
