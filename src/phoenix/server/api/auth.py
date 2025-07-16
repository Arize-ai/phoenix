from abc import ABC
from typing import Any

from strawberry import Info
from strawberry.permission import BasePermission
from typing_extensions import override

from phoenix.config import get_env_support_email
from phoenix.server.api.exceptions import InsufficientStorage, Unauthorized
from phoenix.server.bearer_auth import PhoenixUser


class Authorization(BasePermission, ABC):
    def on_unauthorized(self) -> None:
        raise Unauthorized(self.message)


class IsNotReadOnly(Authorization):
    message = "Application is read-only"

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        return not info.context.read_only


class IsLocked(BasePermission):
    """
    Disables mutations and subscriptions that create or update data but allows
    queries and delete mutations.
    """

    @override
    def on_unauthorized(self) -> None:
        message = (
            "Database operations are disabled due to insufficient storage. "
            "Please delete old data or increase storage."
        )
        if support_email := get_env_support_email():
            message += f" Need help? Contact us at {support_email}"
        raise InsufficientStorage(message)

    @override
    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        return not (info.context.db.should_not_insert_or_update or info.context.locked)


MSG_ADMIN_ONLY = "Only admin can perform this action"


class IsAdmin(Authorization):
    message = MSG_ADMIN_ONLY

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        if not info.context.auth_enabled:
            return False
        return isinstance((user := info.context.user), PhoenixUser) and user.is_admin


class IsAdminIfAuthEnabled(Authorization):
    message = MSG_ADMIN_ONLY

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        if not info.context.auth_enabled:
            return True
        return isinstance((user := info.context.user), PhoenixUser) and user.is_admin
