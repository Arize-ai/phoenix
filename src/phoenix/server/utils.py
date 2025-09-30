from typing import Any, Mapping


def prepend_root_path(scope: Mapping[str, Any], path: str) -> str:
    """
    Prepends the ASGI root path to the given path if one is configured.

    Normalizes the input path by ensuring it has a leading slash and removing
    trailing slashes. The root path is already normalized by get_root_path().

    Args:
        scope: The ASGI scope dictionary containing the root_path key
        path: The path to prepend the root path to (e.g., "/login", "logout")

    Returns:
        The normalized path with root path prepended if configured,
        otherwise just the normalized path. Never has a trailing slash
        except when the result is just "/".

    Examples:
        With root_path="/apps/phoenix":
        - prepend_root_path(request.scope, "/login") -> "/apps/phoenix/login"
        - prepend_root_path(request.scope, "login") -> "/apps/phoenix/login"
        - prepend_root_path(request.scope, "/") -> "/apps/phoenix"
        - prepend_root_path(request.scope, "") -> "/apps/phoenix"
        - prepend_root_path(request.scope, "login/") -> "/apps/phoenix/login"
        - prepend_root_path(request.scope, "/login/") -> "/apps/phoenix/login"
        - prepend_root_path(request.scope, "abc/def/") -> "/apps/phoenix/abc/def"

        With no root_path:
        - prepend_root_path(request.scope, "/login") -> "/login"
        - prepend_root_path(request.scope, "login") -> "/login"
        - prepend_root_path(request.scope, "/") -> "/"
        - prepend_root_path(request.scope, "") -> "/"
        - prepend_root_path(request.scope, "login/") -> "/login"
        - prepend_root_path(request.scope, "/login/") -> "/login"
        - prepend_root_path(request.scope, "abc/def/") -> "/abc/def"
    """
    path = path if path.startswith("/") else f"/{path}"
    path = path.rstrip("/") or "/"
    root_path = get_root_path(scope)
    if path == "/":
        return root_path or "/"
    return f"{root_path}{path}"


def get_root_path(scope: Mapping[str, Any]) -> str:
    """
    Extracts and normalizes the root path from the ASGI scope.

    The root path is typically set by reverse proxies or when the application
    is mounted at a sub-path (e.g., "/apps/phoenix" when behind a proxy).
    If present, ensures the path has a leading slash and removes trailing slashes.

    Args:
        scope: The ASGI scope dictionary containing the root_path key

    Returns:
        The normalized root path as a string (with leading slash, no trailing slash)
        if configured, otherwise empty string.

    Examples:
        - Behind proxy at "/apps/phoenix": returns "/apps/phoenix"
        - Missing leading slash "apps/phoenix": returns "/apps/phoenix"
        - With trailing slash "/apps/phoenix/": returns "/apps/phoenix"
        - Direct deployment: returns ""
        - None in scope: returns ""
    """
    root_path = str(scope.get("root_path") or "")
    if not root_path:
        return ""
    if not root_path.startswith("/"):
        root_path = f"/{root_path}"
    return root_path.rstrip("/")
