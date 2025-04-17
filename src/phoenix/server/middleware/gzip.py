from starlette.datastructures import Headers
from starlette.middleware.gzip import GZipMiddleware as _GZipMiddleware
from starlette.middleware.gzip import GZipResponder, IdentityResponder
from starlette.types import ASGIApp, Receive, Scope, Send


class GZipMiddleware(_GZipMiddleware):
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
