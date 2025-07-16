"""
Authorization dependencies for FastAPI routes.

Usage:
    Use the provided dependencies (e.g., require_admin) with FastAPI's Depends to restrict access to
    certain routes.

    These dependencies will raise HTTP 403 if the user is not authorized.

    Example:

        from fastapi import APIRouter, Depends
        from phoenix.server.authorization import require_admin

        router = APIRouter()

        @router.post("/dangerous-thing", dependencies=[Depends(require_admin)])
        async def dangerous_thing(...):
            ...

    The require_admin dependency allows only admin or system users to access the route.
    It expects authentication to be enabled and the request.user to be set by the authentication.
"""

from fastapi import HTTPException, Request
from fastapi import status as fastapi_status

from phoenix.config import get_env_support_email
from phoenix.server.bearer_auth import PhoenixUser


def require_admin(request: Request) -> None:
    """
    FastAPI dependency to restrict access to admin or system users only.

    Usage:
        Add as a dependency to any route that should only be accessible by admin or system users:

            @router.post("/dangerous-thing", dependencies=[Depends(require_admin)])
            async def dangerous_thing(...):
                ...

    Behavior:
        - Allows access if the authenticated user is an admin or a system user.
        - Raises HTTP 403 Forbidden if the user is not authorized.
        - Expects authentication to be enabled and request.user to be set by the authentication.
    """
    user = getattr(request, "user", None)
    # System users have all privileges
    if not (isinstance(user, PhoenixUser) and user.is_admin):
        raise HTTPException(
            status_code=fastapi_status.HTTP_403_FORBIDDEN,
            detail="Only admin or system users can perform this action.",
        )


def is_not_locked(request: Request) -> None:
    """
    FastAPI dependency to ensure database operations are not locked due to insufficient storage.

    This dependency checks if data insertion and update operations are disabled due to
    storage capacity limits. When storage thresholds are exceeded, it raises an HTTP 507
    error with actionable guidance for users.

    Usage:
        Add as a dependency to any route that modifies data:

            @router.post("/create-data", dependencies=[Depends(is_not_locked)])
            async def create_data(...):
                ...

    Raises:
        HTTPException: HTTP 507 Insufficient Storage when database operations are locked.
            The error includes guidance on resolving storage issues and support contact
            information if configured.
    """
    if request.app.state.db.should_not_insert_or_update:
        detail = (
            "Database operations are disabled due to insufficient storage. "
            "Please delete old data or increase storage."
        )
        if support_email := get_env_support_email():
            detail += f" Need help? Contact us at {support_email}"
        raise HTTPException(
            status_code=fastapi_status.HTTP_507_INSUFFICIENT_STORAGE,
            detail=detail,
        )
