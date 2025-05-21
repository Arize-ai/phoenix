from typing import Iterable, Iterator

from starlette.middleware.gzip import GZipMiddleware as _GZipMiddleware
from starlette.types import Receive, Scope, Send


class GZipMiddleware(_GZipMiddleware):
    """
    Subclass of Starlette's GZipMiddleware that excludes multipart/mixed responses from compression.

    This middleware adds a check to exclude multipart/mixed content types from compression,
    which is important for streaming responses where compression could interfere with delivery.
    """

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope.get("type") == "http"
            and isinstance(headers := scope.get("headers"), Iterable)
            and _is_multipart(headers)
        ):
            scope["headers"] = list(_remove_accept_encoding(headers))
        await super().__call__(scope, receive, send)


def _is_multipart(
    headers: Iterable[tuple[bytes, bytes]],
) -> bool:
    try:
        for k, v in headers:
            if k.decode().lower() == "accept" and "multipart/mixed" in v.decode().lower():
                return True
    except Exception:
        pass
    return False


def _remove_accept_encoding(
    headers: Iterable[tuple[bytes, bytes]],
) -> Iterator[tuple[bytes, bytes]]:
    return (kv for kv in headers if kv[0].decode().lower() != "accept-encoding")
