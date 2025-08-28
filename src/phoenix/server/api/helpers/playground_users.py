from typing import (
    Optional,
)

from starlette.requests import Request
from strawberry import Info

from phoenix.server.api.context import Context
from phoenix.server.bearer_auth import PhoenixUser


def get_user(info: Info[Context, None]) -> Optional[int]:
    user_id: Optional[int] = None
    try:
        assert isinstance(request := info.context.request, Request)

        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)
    except AssertionError:
        # Request is not available, try to obtain user identify
        # this will also throw an assertion error if auth is not available
        # the finally block will continue execution returning None
        if info.context.user.is_authenticated:
            user_id = int(info.context.user.identity)
    finally:
        return user_id
