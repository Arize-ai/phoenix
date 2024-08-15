from typing import Any

from strawberry import Info
from strawberry.permission import BasePermission


class IsAuthenticated(BasePermission):
    message = "User is not authenticated"

    async def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        return not info.context.read_only


class HasSecret(BasePermission):
    message = "Application secret is not set"

    async def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        return info.context.secret is not None
