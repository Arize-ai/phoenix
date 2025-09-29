from datetime import datetime
from typing import Optional, cast

import pandas as pd
import pyarrow as pa
from starlette.datastructures import URLPath
from starlette.requests import Request


def table_to_bytes(table: pa.Table) -> bytes:
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    return cast(bytes, sink.getvalue().to_pybytes())


def from_iso_format(value: Optional[str]) -> Optional[datetime]:
    return datetime.fromisoformat(value) if value else None


def df_to_bytes(df: pd.DataFrame) -> bytes:
    pa_table = pa.Table.from_pandas(df)
    return table_to_bytes(pa_table)


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
        With root_path="/api/v1":
        - prepend_root_path_if_exists(request, "/login") -> "/api/v1/login"
        - prepend_root_path_if_exists(request, "login") -> "/api/v1/login"

        With no root_path:
        - prepend_root_path_if_exists(request, "/login") -> "/login"
        - prepend_root_path_if_exists(request, "login") -> "/login"
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


def append_root_path(*, request: Request, base_url: str) -> str:
    """
    If a root path is configured, appends it to the input base url.
    """
    if not (root_path := get_root_path(request=request)):
        return base_url
    return str(URLPath(root_path).make_absolute_url(base_url=base_url))


def get_root_path(*, request: Request) -> str:
    """
    Extracts the root path from the ASGI request scope.

    The root path is typically set by reverse proxies or when the application
    is mounted at a sub-path (e.g., "/api/v1" when behind a proxy).

    Args:
        request: The FastAPI/Starlette request object containing ASGI scope

    Returns:
        The root path as a string, or empty string if not configured.

    Examples:
        - Behind proxy at "/api/v1": returns "/api/v1"
        - Direct deployment: returns ""
        - None in scope: returns ""
    """
    return request.scope.get("root_path") or ""
