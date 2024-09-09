from abc import ABC
from typing import Any

from strawberry import Info
from strawberry.permission import BasePermission

from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.bearer_auth import PhoenixUser


class Authorization(BasePermission, ABC):
    def on_unauthorized(self) -> None:
        raise Unauthorized(self.message)


class IsNotReadOnly(Authorization):
    message = "Application is read-only"

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        return not info.context.read_only


MSG_ADMIN_ONLY = "Only admin can perform this action"


class IsAdmin(Authorization):
    message = MSG_ADMIN_ONLY

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        if not info.context.auth_enabled:
            return False
        return isinstance((user := info.context.user), PhoenixUser) and user.is_admin
