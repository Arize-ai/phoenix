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
