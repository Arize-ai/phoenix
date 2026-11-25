from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import PlainTextResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from phoenix.server.middleware.client_disconnect import ClientDisconnectMiddleware


class _PassThrough(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        return await call_next(request)


async def _stops_on_disconnect(scope: Scope, receive: Receive, send: Send) -> None:
    """Like the MCP transport: reads until the client hangs up, then returns silently."""
    while (await receive())["type"] != "http.disconnect":
        pass


async def _call(app: ASGIApp, events: list[Message]) -> list[Message]:
    sent: list[Message] = []

    async def receive() -> Message:
        return events.pop(0) if events else {"type": "http.disconnect"}

    async def send(message: Message) -> None:
        sent.append(message)

    scope = {"type": "http", "method": "POST", "path": "/mcp/", "headers": []}
    await app(scope, receive, send)
    return sent


async def test_sends_499_when_the_client_hung_up_before_a_response() -> None:
    app = _PassThrough(ClientDisconnectMiddleware(_stops_on_disconnect))
    sent = await _call(app, [{"type": "http.request", "body": b"{}", "more_body": False}])
    assert [m["status"] for m in sent if m["type"] == "http.response.start"] == [499]


async def test_leaves_a_started_response_alone() -> None:
    async def responds(scope: Scope, receive: Receive, send: Send) -> None:
        await receive()
        await PlainTextResponse("ok")(scope, receive, send)
        await receive()  # http.disconnect, after the response started

    app = ClientDisconnectMiddleware(responds)
    sent = await _call(app, [{"type": "http.request", "body": b"", "more_body": False}])
    assert [m["status"] for m in sent if m["type"] == "http.response.start"] == [200]


async def test_sends_nothing_when_the_client_is_still_connected() -> None:
    async def returns_silently(scope: Scope, receive: Receive, send: Send) -> None:
        await receive()

    app = ClientDisconnectMiddleware(returns_silently)
    sent = await _call(app, [{"type": "http.request", "body": b"", "more_body": False}])
    assert sent == []
