from typing import Any

from strawberry import Info
from strawberry.permission import BasePermission

from phoenix.auth import ClaimStatus, PhoenixUser


class IsNotReadOnly(BasePermission):
    message = "Application is read-only"

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        return not info.context.read_only


class IsAuthenticated(BasePermission):
    message = "User is not authenticated"

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        if info.context.token_store is None:
            return True
        try:
            user = info.context.request.user
        except AttributeError:
            return False
        return isinstance(user, PhoenixUser) and user.claim.status is ClaimStatus.VALID


class IsAdmin(BasePermission):
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
            and user.claim.status is ClaimStatus.VALID
            and user.claim.attributes is not None
            and user.claim.attributes.user_role == "ADMIN"
        )


class HasSecret(BasePermission):
    message = "Application secret is not set"

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        return info.context.secret is not None
