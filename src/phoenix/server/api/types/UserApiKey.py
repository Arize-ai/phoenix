from typing import TYPE_CHECKING

import strawberry
from strawberry import Private
from strawberry.relay import Node, NodeID
from typing_extensions import Annotated

from phoenix.db.models import ApiKey as OrmApiKey

from .ApiKey import ApiKey

if TYPE_CHECKING:
    from .User import User


@strawberry.type
class UserApiKey(ApiKey, Node):
    id_attr: NodeID[int]
    user_id: Private[int]

    @strawberry.field
    async def user(self) -> Annotated["User", strawberry.lazy(".User")]:
        from .User import User

        return User(id=self.user_id)


def to_gql_api_key(api_key: OrmApiKey) -> UserApiKey:
    """
    Converts an ORM API key to a GraphQL UserApiKey type.
    """
    return UserApiKey(
        id_attr=api_key.id,
        user_id=api_key.user_id,
        name=api_key.name,
        description=api_key.description,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at,
    )
