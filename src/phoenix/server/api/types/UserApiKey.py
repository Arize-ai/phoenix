import strawberry
from strawberry import Private
from strawberry.relay.types import Node, NodeID
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound

from .ApiKey import ApiKey
from .User import User, to_gql_User


@strawberry.type
class UserApiKey(ApiKey, Node):
    id_attr: NodeID[int]
    user_id: Private[int]

    @strawberry.field
    async def user(self, info: Info[Context, None]) -> User:
        user = await info.context.data_loaders.users.load(self.user_id)
        if user is None:
            raise NotFound(f"User with id {self.user_id} not found")
        return to_gql_User(user)
