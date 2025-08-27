from typing import (
    Optional,
)
from phoenix.server.bearer_auth import PhoenixUser
from strawberry import Info
from phoenix.server.api.context import Context
from starlette.requests import Request


def get_user(info: Info[Context, None]) -> int:
    assert isinstance(request := info.context.request, Request)
    user_id: Optional[int] = None
    if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
        user_id = int(user.identity)

    return user_id
