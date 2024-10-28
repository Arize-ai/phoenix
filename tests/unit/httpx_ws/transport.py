import contextlib
import queue
import typing
from concurrent.futures import Future

import anyio
import wsproto
from httpcore import AsyncNetworkStream
from httpx import ASGITransport, AsyncByteStream, Request, Response
from wsproto.frame_protocol import CloseReason

from ._exceptions import WebSocketDisconnect

Scope = dict[str, typing.Any]
Message = dict[str, typing.Any]
Receive = typing.Callable[[], typing.Awaitable[Message]]
Send = typing.Callable[[Scope], typing.Coroutine[None, None, None]]
ASGIApp = typing.Callable[[Scope, Receive, Send], typing.Coroutine[None, None, None]]


class ASGIWebSocketTransportError(Exception):
    pass


class UnhandledASGIMessageType(ASGIWebSocketTransportError):
    def __init__(self, message: Message) -> None:
        self.message = message


class UnhandledWebSocketEvent(ASGIWebSocketTransportError):
    def __init__(self, event: wsproto.events.Event) -> None:
        self.event = event


class ASGIWebSocketAsyncNetworkStream(AsyncNetworkStream):
    def __init__(self, app: ASGIApp, scope: Scope) -> None:
        self.app = app
        self.scope = scope
        self._receive_queue: queue.Queue[Message] = queue.Queue()
        self._send_queue: queue.Queue[Message] = queue.Queue()
        self.connection = wsproto.WSConnection(wsproto.ConnectionType.SERVER)
        self.connection.initiate_upgrade_connection(scope["headers"], scope["path"])

    async def __aenter__(
        self,
    ) -> tuple["ASGIWebSocketAsyncNetworkStream", bytes]:
        self.exit_stack = contextlib.ExitStack()
        self.portal = self.exit_stack.enter_context(
            anyio.from_thread.start_blocking_portal("asyncio")
        )
        _: Future[None] = self.portal.start_task_soon(self._run)

        await self.send({"type": "websocket.connect"})
        message = await self.receive()

        if message["type"] == "websocket.close":
            await self.aclose()
            raise WebSocketDisconnect(message["code"], message.get("reason"))

        assert message["type"] == "websocket.accept"
        return self, self._build_accept_response(message)

    async def __aexit__(self, *args: typing.Any) -> None:
        await self.aclose()

    async def read(self, max_bytes: int, timeout: typing.Optional[float] = None) -> bytes:
        message: Message = await self.receive(timeout=timeout)
        type = message["type"]

        if type not in {"websocket.send", "websocket.close"}:
            raise UnhandledASGIMessageType(message)

        event: wsproto.events.Event
        if type == "websocket.send":
            data_str: typing.Optional[str] = message.get("text")
            if data_str is not None:
                event = wsproto.events.TextMessage(data_str)
            data_bytes: typing.Optional[bytes] = message.get("bytes")
            if data_bytes is not None:
                event = wsproto.events.BytesMessage(data_bytes)
        elif type == "websocket.close":
            event = wsproto.events.CloseConnection(message["code"], message["reason"])

        return self.connection.send(event)

    async def write(self, buffer: bytes, timeout: typing.Optional[float] = None) -> None:
        self.connection.receive_data(buffer)
        for event in self.connection.events():
            if isinstance(event, wsproto.events.Request):
                pass
            elif isinstance(event, wsproto.events.CloseConnection):
                await self.send(
                    {
                        "type": "websocket.close",
                        "code": event.code,
                        "reason": event.reason,
                    }
                )
            elif isinstance(event, wsproto.events.TextMessage):
                await self.send({"type": "websocket.receive", "text": event.data})
            elif isinstance(event, wsproto.events.BytesMessage):
                await self.send({"type": "websocket.receive", "bytes": event.data})
            else:
                raise UnhandledWebSocketEvent(event)

    async def aclose(self) -> None:
        await self.send({"type": "websocket.close"})
        self.exit_stack.close()

    async def send(self, message: Message) -> None:
        self._receive_queue.put(message)

    async def receive(self, timeout: typing.Optional[float] = None) -> Message:
        while self._send_queue.empty():
            await anyio.sleep(0)
        return self._send_queue.get(timeout=timeout)

    async def _run(self) -> None:
        """
        The sub-thread in which the websocket session runs.
        """
        scope = self.scope
        receive = self._asgi_receive
        send = self._asgi_send
        try:
            await self.app(scope, receive, send)
        except Exception as e:
            message = {
                "type": "websocket.close",
                "code": CloseReason.INTERNAL_ERROR,
                "reason": str(e),
            }
            await self._asgi_send(message)

    async def _asgi_receive(self) -> Message:
        while self._receive_queue.empty():
            await anyio.sleep(0)
        return self._receive_queue.get()

    async def _asgi_send(self, message: Message) -> None:
        self._send_queue.put(message)

    def _build_accept_response(self, message: Message) -> bytes:
        subprotocol = message.get("subprotocol", None)
        headers = message.get("headers", [])
        return self.connection.send(
            wsproto.events.AcceptConnection(
                subprotocol=subprotocol,
                extra_headers=headers,
            )
        )


class ASGIWebSocketTransport(ASGITransport):
    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.exit_stack: typing.Optional[contextlib.AsyncExitStack] = None

    async def handle_async_request(self, request: Request) -> Response:
        scheme = request.url.scheme
        headers = request.headers

        if scheme in {"ws", "wss"} or headers.get("upgrade") == "websocket":
            subprotocols: list[str] = []
            if (subprotocols_header := headers.get("sec-websocket-protocol")) is not None:
                subprotocols = subprotocols_header.split(",")

            scope = {
                "type": "websocket",
                "path": request.url.path,
                "raw_path": request.url.raw_path,
                "root_path": self.root_path,
                "scheme": scheme,
                "query_string": request.url.query,
                "headers": [(k.lower(), v) for (k, v) in request.headers.raw],
                "client": self.client,
                "server": (request.url.host, request.url.port),
                "subprotocols": subprotocols,
            }
            return await self._handle_ws_request(request, scope)

        return await super().handle_async_request(request)

    async def _handle_ws_request(
        self,
        request: Request,
        scope: Scope,
    ) -> Response:
        assert isinstance(request.stream, AsyncByteStream)

        self.scope = scope
        self.exit_stack = contextlib.AsyncExitStack()
        stream, accept_response = await self.exit_stack.enter_async_context(
            ASGIWebSocketAsyncNetworkStream(self.app, self.scope)  # type: ignore[arg-type]
        )

        accept_response_lines = accept_response.decode("utf-8").splitlines()
        headers = [
            typing.cast(tuple[str, str], line.split(": ", 1))
            for line in accept_response_lines[1:]
            if line.strip() != ""
        ]

        return Response(
            status_code=101,
            headers=headers,
            extensions={"network_stream": stream},
        )

    async def aclose(self) -> None:
        if self.exit_stack:
            await self.exit_stack.aclose()
