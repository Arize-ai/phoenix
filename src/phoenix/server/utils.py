from starlette.requests import Request


def prepend_root_path(*, request: Request, path: str) -> str:
    """
    Prepends the ASGI root path to the given path if one is configured.

    Automatically normalizes paths by ensuring leading slashes are present
    and removing trailing slashes to prevent double slashes in the result.

    Args:
        request: The FastAPI/Starlette request object containing ASGI scope
        path: The path to prepend the root path to (e.g., "/login", "logout")

    Returns:
        The normalized path with root path prepended if configured,
        otherwise just the normalized path.

    Examples:
        With root_path="/apps/phoenix":
        - prepend_root_path(request, "/login") -> "/apps/phoenix/login"
        - prepend_root_path(request, "login") -> "/apps/phoenix/login"

        With no root_path:
        - prepend_root_path(request, "/login") -> "/login"
        - prepend_root_path(request, "login") -> "/login"
    """
    if not path.startswith("/"):
        path = "/" + path

    root_path = get_root_path(request=request)

    if not root_path:
        return path

    if not root_path.startswith("/"):
        root_path = "/" + root_path

    root_path = root_path.rstrip("/")

    return root_path + path


def get_root_path(*, request: Request) -> str:
    """
    Extracts the root path from the ASGI request scope.

    The root path is typically set by reverse proxies or when the application
    is mounted at a sub-path (e.g., "/apps/phoenix" when behind a proxy).

    Args:
        request: The FastAPI/Starlette request object containing ASGI scope

    Returns:
        The root path as a string, or empty string if not configured.

    Examples:
        - Behind proxy at "/apps/phoenix": returns "/apps/phoenix"
        - Direct deployment: returns ""
        - None in scope: returns ""
    """
    return request.scope.get("root_path") or ""
