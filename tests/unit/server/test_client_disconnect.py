import contextlib
import json
from typing import Any

import pytest
from asgi_lifespan import LifespanManager
from starlette.types import ASGIApp, Message

from phoenix.server.app import create_app
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import TestBulkInserter, patch_dml_event_handler, patch_grpc_server


async def _post_then_disconnect(app: ASGIApp, *, path: str, content_type: str) -> list[Message]:
    """
    Drive the real ASGI app the way uvicorn does when a client hangs up before
    the request body is complete: the first ``receive()`` yields a partial body
    chunk (``more_body=True``) and the next one yields ``http.disconnect``.
    """
    events: list[Message] = [
        {"type": "http.request", "body": b"partial", "more_body": True},
        {"type": "http.disconnect"},
    ]
    sent: list[Message] = []

    async def receive() -> Message:
        return events.pop(0) if events else {"type": "http.disconnect"}

    async def send(message: Message) -> None:
        sent.append(message)

    scope: dict[str, Any] = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "root_path": "",
        "query_string": b"",
        "headers": [
            (b"host", b"test"),
            (b"content-type", content_type.encode()),
            (b"content-length", b"1000"),
        ],
        "client": ("127.0.0.1", 12345),
        "server": ("test", 80),
    }
    await app(scope, receive, send)
    return sent


@pytest.mark.parametrize(
    "path, content_type",
    [
        pytest.param("/v1/traces", "application/x-protobuf", id="rest-v1-traces"),
        pytest.param("/graphql", "application/json", id="graphql"),
    ],
)
async def test_client_disconnect_while_reading_body_does_not_escape_app(
    asgi_app: ASGIApp,
    path: str,
    content_type: str,
) -> None:
    """
    A client that disconnects before its request body is fully read ends the
    request quietly with a 499 instead of an unhandled ClientDisconnect.
    """
    sent = await _post_then_disconnect(asgi_app, path=path, content_type=content_type)
    statuses = [m["status"] for m in sent if m["type"] == "http.response.start"]
    assert statuses == [499]


async def test_client_disconnect_during_mcp_tool_call_does_not_escape_app(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    An MCP client that hangs up while its tool call is still running ends the
    request quietly instead of surfacing as an unhandled exception and a 500.

    On a stateless MCP 2026-07-28 request, the MCP SDK cancels the tool call
    when it receives ``http.disconnect`` and returns without sending a
    response (mcp/server/_streamable_http_modern.py, ``watch_disconnect``).
    Every ``BaseHTTPMiddleware`` around the mount then raises
    ``RuntimeError("No response returned.")`` from ``call_next``.
    """
    monkeypatch.setattr("phoenix.server.app.get_env_enable_mcp_server", lambda: True)
    monkeypatch.setattr("phoenix.server.mcp_server.get_env_mcp_code_mode", lambda: False)
    protocol_version = "2026-07-28"
    body = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "describeSqlSchema",
                "arguments": {},
                "_meta": {
                    "io.modelcontextprotocol/protocolVersion": protocol_version,
                    "io.modelcontextprotocol/clientCapabilities": {},
                },
            },
        }
    ).encode()
    # The whole body arrives, then the client hangs up before the response.
    events: list[Message] = [{"type": "http.request", "body": body, "more_body": False}]
    sent: list[Message] = []

    async def receive() -> Message:
        return events.pop(0) if events else {"type": "http.disconnect"}

    async def send(message: Message) -> None:
        sent.append(message)

    scope: dict[str, Any] = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/mcp",
        "raw_path": b"/mcp",
        "root_path": "",
        "query_string": b"",
        "headers": [
            (b"host", b"testserver"),
            (b"content-type", b"application/json"),
            (b"accept", b"application/json, text/event-stream"),
            (b"content-length", str(len(body)).encode()),
            (b"mcp-protocol-version", protocol_version.encode()),
            (b"mcp-method", b"tools/call"),
            (b"mcp-name", b"describeSqlSchema"),
        ],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    }
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_dml_event_handler())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
        )
        manager = await stack.enter_async_context(LifespanManager(app))
        await manager.app(scope, receive, send)
    statuses = [m["status"] for m in sent if m["type"] == "http.response.start"]
    assert all(status < 500 for status in statuses), statuses
