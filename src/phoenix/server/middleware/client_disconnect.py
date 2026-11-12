import logging

from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger(__name__)


class ClientDisconnectMiddleware:
    """
    Pure-ASGI middleware that ends a request with a 499 when the client hung up
    and the app below returned without starting a response.

    Some apps stop quietly when they see ``http.disconnect``: the MCP
    streamable-HTTP transport, for example, cancels a tool call and returns
    without sending anything when its client hangs up. Every
    ``BaseHTTPMiddleware`` above such an app then raises
    ``RuntimeError("No response returned.")`` from ``call_next``, which
    surfaces as an unhandled exception and a 500. Nobody is left to receive the
    response, so the 499 only lets the middleware stack finish normally.

    It must be the innermost middleware, so that every ``BaseHTTPMiddleware``
    sits above it.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        disconnected = False
        response_started = False

        async def receive_wrapper() -> Message:
            nonlocal disconnected
            message = await receive()
            if message["type"] == "http.disconnect":
                disconnected = True
            return message

        async def send_wrapper(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        await self.app(scope, receive_wrapper, send_wrapper)
        if disconnected and not response_started:
            logger.debug("Client disconnected before a response was started: %s", scope["path"])
            # 499 (Client Closed Request) is the nginx convention for this case.
            await send({"type": "http.response.start", "status": 499, "headers": []})
            await send({"type": "http.response.body", "body": b"", "more_body": False})
