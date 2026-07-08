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


class IsNotViewer(Authorization):
    message = "Viewers cannot perform this action"

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        if not info.context.auth_enabled:
            return True
        return isinstance((user := info.context.user), PhoenixUser) and not user.is_viewer


class IsLocked(BasePermission):
    """
    Permission class that restricts data-modifying operations when insufficient storage.

    When database storage capacity is exceeded, this permission blocks mutations and
    subscriptions that create or update data, while allowing queries and delete mutations
    to continue. This prevents database overflow while maintaining read access and the
    ability to free up space through deletions.

    Raises:
        InsufficientStorage: When storage capacity is exceeded and data operations
            are temporarily disabled. The error includes guidance for resolution
            and support contact information if configured.
    """

    @override
    def on_unauthorized(self) -> None:
        """Create user-friendly error message when storage operations are blocked."""
        message = (
            "Database operations are disabled due to insufficient storage. "
            "Please delete old data or increase storage."
        )
        if support_email := get_env_support_email():
            message += f" Need help? Contact us at {support_email}"
        raise InsufficientStorage(message)

    @override
    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        """Check if database operations are allowed based on storage capacity and lock status."""
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
