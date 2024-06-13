from typing import Any

from strawberry import Info
from strawberry.permission import BasePermission


class IsAuthenticated(BasePermission):
    message = "User is not authenticated"

    async def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        return not info.context.read_only
