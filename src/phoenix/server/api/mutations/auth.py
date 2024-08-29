from abc import ABC
from typing import Any

from strawberry import Info
from strawberry.permission import BasePermission

from phoenix.db import enums
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.bearer_auth import PhoenixUser


class _Security(BasePermission, ABC):
    def on_unauthorized(self) -> None:
        raise Unauthorized(self.message)


class IsNotReadOnly(_Security):
    message = "Application is read-only"

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        return not info.context.read_only


class IsAuthenticated(_Security):
    message = "User is not authenticated"

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        if info.context.token_store is None:
            return True
        try:
            user = info.context.request.user
        except AttributeError:
            return False
        return isinstance(user, PhoenixUser) and user.is_authenticated


class IsAdmin(_Security):
    message = "Only admin can perform this action"

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        if info.context.token_store is None:
            return False
        try:
            user = info.context.request.user
        except AttributeError:
            return False
        return (
            isinstance(user, PhoenixUser)
            and user.is_authenticated
            and user.claims is not None
            and user.claims.attributes is not None
            and user.claims.attributes.user_role == enums.UserRole.ADMIN
        )


class HasSecret(BasePermission):
    message = "Application secret is not set"

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        return info.context.secret is not None
