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

from phoenix.config import ENV_PHOENIX_ENABLE_AUTH, get_env_support_email
from phoenix.server.bearer_auth import PhoenixUser


def require_auth_enabled(request: Request) -> None:
    """
    FastAPI dependency to restrict access to routes that are only safe when
    authentication is enabled.

    Usage:
        Add as a dependency to any route that issues credentials:

            @router.post("/api_keys", dependencies=[Depends(require_auth_enabled)])
            async def create_api_key(...):
                ...

    Behavior:
        - Allows access if authentication is enabled.
        - Raises HTTP 403 Forbidden otherwise.

    Without authentication, Phoenix has no notion of identity, so every caller is
    already anonymous and unrestricted. Minting a credential in that state would
    hand out a bearer token that outlives the deployment's current configuration,
    which amounts to an escalation of privilege. Such routes must fail closed.
    """
    if not request.app.state.authentication_enabled:
        raise HTTPException(
            status_code=403,
            detail=(
                "This action requires authentication to be enabled. "
                f"Set the {ENV_PHOENIX_ENABLE_AUTH} environment variable to true."
            ),
        )


def prevent_access_in_read_only_mode(request: Request) -> None:
    """
    Prevent access to mutating REST routes when the app is running in read-only mode.
    """
    if request.app.state.read_only:
        raise HTTPException(
            detail="The Phoenix REST API is disabled in read-only mode.",
            status_code=403,
        )


def restrict_access_by_viewers(request: Request) -> None:
    """
    Prevent viewer users from accessing mutating REST routes when auth is enabled.
    """
    if not request.app.state.authentication_enabled or request.method == "GET":
        return
    user = getattr(request, "user", None)
    if isinstance(user, PhoenixUser) and user.is_viewer:
        raise HTTPException(
            status_code=403,
            detail="Viewers cannot perform this action.",
        )


def is_agent_assistant_enabled(request: Request) -> None:
    """Prevent access to agent routes when the assistant is disabled."""
    if not request.app.state.system_settings.agent_assistant_enabled.enabled:
        raise HTTPException(status_code=403, detail="Agents are disabled")


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
        - Allows access if authentication is not enabled.
    """
    if not request.app.state.authentication_enabled:
        return
    user = getattr(request, "user", None)
    # System users have all privileges
    if not (isinstance(user, PhoenixUser) and user.is_admin):
        raise HTTPException(
            status_code=403,
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
            status_code=507,
            detail=detail,
        )
