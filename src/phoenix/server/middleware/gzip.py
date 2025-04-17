from starlette.datastructures import Headers
from starlette.middleware.gzip import GZipMiddleware as _GZipMiddleware
from starlette.middleware.gzip import GZipResponder, IdentityResponder
from starlette.types import ASGIApp, Receive, Scope, Send


class GZipMiddleware(_GZipMiddleware):
    """
    Subclass of Starlette's GZipMiddleware that excludes multipart/mixed responses from compression.

    This middleware adds a check to exclude multipart/mixed content types from compression,
    which is important for streaming responses where compression could interfere with delivery.

    The middleware will use the IdentityResponder (no compression) when:
    1. The client doesn't support gzip compression, or
    2. The response is a multipart/mixed content type
    """

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        responder: ASGIApp
        if "gzip" not in headers.get("Accept-Encoding", "") or "multipart/mixed" in headers.get(
            "Accept", ""
        ):
            responder = IdentityResponder(self.app, self.minimum_size)
        else:
            responder = GZipResponder(self.app, self.minimum_size, compresslevel=self.compresslevel)

        await responder(scope, receive, send)
